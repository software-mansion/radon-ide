import { EventEmitter } from "stream";
import os from "os";
import path from "path";
import fs from "fs";
import {
  env,
  Disposable,
  commands,
  workspace,
  window,
  DebugSessionCustomEvent,
  Uri,
  extensions,
  ConfigurationChangeEvent,
} from "vscode";
import _ from "lodash";
import { minimatch } from "minimatch";
import {
  AppPermissionType,
  DeviceButtonType,
  DeviceSettings,
  InspectData,
  ProjectEventListener,
  ProjectEventMap,
  ProjectInterface,
  ProjectState,
  ReloadAction,
  SelectDeviceOptions,
  StartupMessage,
  ToolsState,
  TouchPoint,
  ZoomLevelType,
} from "../common/Project";
import { Logger } from "../Logger";
import { DeviceInfo } from "../common/DeviceManager";
import { DeviceManager } from "../devices/DeviceManager";
import { extensionContext } from "../utilities/extensionContext";
import { throttle } from "../utilities/throttle";
import { DebugSource } from "../debugging/DebugSession";
import { AppEvent, DeviceSessionDelegate } from "./deviceSession";
import { PanelLocation } from "../common/WorkspaceConfig";
import {
  activateDevice,
  watchLicenseTokenChange,
  getLicenseToken,
  refreshTokenPeriodically,
} from "../utilities/license";
import { getTelemetryReporter } from "../utilities/telemetry";
import { ToolKey } from "./tools";
import { UtilsInterface } from "../common/utils";
import { ApplicationContext } from "./ApplicationContext";
import { disposeAll } from "../utilities/disposables";
import { findAndSetupNewAppRootFolder } from "../utilities/findAndSetupNewAppRootFolder";
import { focusSource } from "../utilities/focusSource";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { DeviceSessionsManager } from "./DeviceSessionsManager";

const PREVIEW_ZOOM_KEY = "preview_zoom";
const DEEP_LINKS_HISTORY_KEY = "deep_links_history";

const DEEP_LINKS_HISTORY_LIMIT = 50;

const MAX_RECORDING_TIME_SEC = 10 * 60; // 10 minutes

export class Project implements Disposable, ProjectInterface, DeviceSessionDelegate {
  private applicationContext: ApplicationContext;
  private eventEmitter = new EventEmitter();

  private deviceSessionsManager: DeviceSessionsManager;

  private projectState: ProjectState = {
    status: "starting",
    stageProgress: 0,
    startupMessage: StartupMessage.InitializingDevice,
    previewURL: undefined,
    previewZoom: extensionContext.workspaceState.get(PREVIEW_ZOOM_KEY),
    selectedDevice: undefined,
    initialized: false,
  };

  private disposables: Disposable[] = [];

  private get deviceSession() {
    return this.deviceSessionsManager.selectedDeviceSession;
  }

  constructor(
    private readonly deviceManager: DeviceManager,
    private readonly utils: UtilsInterface
  ) {
    const appRoot = findAndSetupNewAppRootFolder();
    this.applicationContext = new ApplicationContext(appRoot);
    this.deviceSessionsManager = new DeviceSessionsManager(
      this.applicationContext,
      this.deviceManager,
      this,
      (newState) => {
        this.updateProjectState(newState);
      }
    );

    this.deviceSessionsManager.trySelectingDevice();
    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);
    this.disposables.push(refreshTokenPeriodically());
    this.disposables.push(
      watchLicenseTokenChange(async () => {
        const hasActiveLicense = await this.hasActiveLicense();
        this.eventEmitter.emit("licenseActivationChanged", hasActiveLicense);
      })
    );

    this.disposables.push(
      workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration("launch")) {
          const config = getLaunchConfiguration();
          const oldAppRoot = this.appRootFolder;
          if (config.appRoot === oldAppRoot) {
            return;
          }
          this.setupAppRoot();

          if (this.appRootFolder === undefined) {
            window.showErrorMessage(
              "Unable to find the new app root, after a change in launch configuration. Radon IDE might not work properly.",
              "Dismiss"
            );
            return;
          }
        }
      })
    );
  }

  get appRootFolder() {
    return this.applicationContext.appRootFolder;
  }

  get dependencyManager() {
    return this.applicationContext.dependencyManager;
  }

  get launchConfig() {
    return this.applicationContext.launchConfig;
  }

  get buildCache() {
    return this.applicationContext.buildCache;
  }

  private setupAppRoot() {
    const newAppRoot = findAndSetupNewAppRootFolder();

    const oldApplicationContext = this.applicationContext;
    this.applicationContext = new ApplicationContext(newAppRoot);
    oldApplicationContext.dispose();

    const oldDeviceSessionsManager = this.deviceSessionsManager;
    this.deviceSessionsManager = this.deviceSessionsManager = new DeviceSessionsManager(
      this.applicationContext,
      this.deviceManager,
      this,
      (newState) => {
        this.updateProjectState(newState);
      }
    );
    oldDeviceSessionsManager.dispose();

    this.deviceSessionsManager.trySelectingDevice();
  }

  //#region Device Session Delegate
  onBuildProgress = (stageProgress: number): void => {
    this.reportStageProgress(stageProgress, StartupMessage.Building);
  };

  onStateChange = (state: StartupMessage): void => {
    this.updateProjectState({ startupMessage: state });
  };

  public onReloadStarted(id: string): void {
    this.updateProjectStateForDevice(id, {
      status: "starting",
      startupMessage: StartupMessage.Restarting,
    });
  }

  public onReloadCompleted(id: string): void {
    this.updateProjectStateForDevice(id, {
      status: "running",
    });
  }

  public onCacheStale(): void {
    this.eventEmitter.emit("needsNativeRebuild");
  }

  public onPreviewReady(previewURL: string): void {
    this.updateProjectState({ previewURL });
  }

  //#endregion

  //#region App events
  onAppEvent = <E extends keyof AppEvent, P = AppEvent[E]>(event: E, payload: P): void => {
    switch (event) {
      case "navigationChanged":
        this.eventEmitter.emit("navigationChanged", payload);
        break;
      case "fastRefreshStarted":
        this.updateProjectState({ status: "refreshing" });
        break;
      case "fastRefreshComplete":
        const ignoredEvents = ["starting", "bundlingError"];
        if (ignoredEvents.includes(this.projectState.status)) {
          return;
        }
        this.updateProjectState({ status: "running" });
        break;
    }
  };
  //#endregion

  //#region Debugger events
  onConsoleLog(event: DebugSessionCustomEvent) {
    this.eventEmitter.emit("log", event.body);
  }

  onDebuggerPaused(event: DebugSessionCustomEvent) {
    this.updateProjectState({ status: "debuggerPaused" });

    // we don't want to focus on debug side panel if it means hiding Radon IDE
    const panelLocation = workspace
      .getConfiguration("RadonIDE")
      .get<PanelLocation>("panelLocation");

    if (panelLocation === "tab") {
      commands.executeCommand("workbench.view.debug");
    }
  }

  onDebuggerResumed() {
    const ignoredEvents = ["starting", "bundlingError"];
    if (ignoredEvents.includes(this.projectState.status)) {
      return;
    }
    this.updateProjectState({ status: "running" });
  }

  //#endregion

  //#region Recordings and screenshots

  private recordingTimeout: NodeJS.Timeout | undefined = undefined;

  startRecording(): void {
    getTelemetryReporter().sendTelemetryEvent("recording:start-recording", {
      platform: this.projectState.selectedDevice?.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.startRecording();
    this.eventEmitter.emit("isRecording", true);

    this.recordingTimeout = setTimeout(() => {
      this.stopRecording();
    }, MAX_RECORDING_TIME_SEC * 1000);
  }

  private async stopRecording() {
    clearTimeout(this.recordingTimeout);

    getTelemetryReporter().sendTelemetryEvent("recording:stop-recording", {
      platform: this.projectState.selectedDevice?.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.eventEmitter.emit("isRecording", false);
    return this.deviceSession.captureAndStopRecording();
  }

  async startProfilingCPU() {
    if (this.deviceSession) {
      await this.deviceSession.startProfilingCPU();
    } else {
      throw new Error("No device session available");
    }
  }

  async stopProfilingCPU() {
    if (this.deviceSession) {
      await this.deviceSession.stopProfilingCPU();
    } else {
      throw new Error("No device session available");
    }
  }

  onProfilingCPUStarted(event: DebugSessionCustomEvent): void {
    this.eventEmitter.emit("isProfilingCPU", true);
  }

  async onProfilingCPUStopped(event: DebugSessionCustomEvent) {
    this.eventEmitter.emit("isProfilingCPU", false);

    // Handle the profile file if a file path is provided
    if (event.body && event.body.filePath) {
      const tempFilePath = event.body.filePath;

      // Show save dialog to save the profile file to the workspace folder:
      let defaultUri = Uri.file(tempFilePath);
      const workspaceFolder = workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        defaultUri = Uri.file(path.join(workspaceFolder.uri.fsPath, path.basename(tempFilePath)));
      }

      const saveDialog = await window.showSaveDialog({
        defaultUri,
        filters: {
          "CPU Profile": ["cpuprofile"],
        },
      });

      if (saveDialog) {
        await fs.promises.copyFile(tempFilePath, saveDialog.fsPath);
        commands.executeCommand("vscode.open", Uri.file(saveDialog.fsPath));

        // verify whether flame chart visualizer extension is installed
        // flame chart visualizer is not necessary to open the cpuprofile file, but when it is installed,
        // the user can use the flame button from cpuprofile view to visualize it differently
        const flameChartExtension = extensions.getExtension("ms-vscode.vscode-js-profile-flame");
        if (!flameChartExtension) {
          const GO_TO_EXTENSION_BUTTON = "Go to Extension";
          window
            .showInformationMessage(
              "Flame Chart Visualizer extension is not installed. It is recommended to install it for better profiling insights.",
              GO_TO_EXTENSION_BUTTON
            )
            .then((action) => {
              if (action === GO_TO_EXTENSION_BUTTON) {
                commands.executeCommand(
                  "workbench.extensions.search",
                  "ms-vscode.vscode-js-profile-flame"
                );
              }
            });
        }
      }
    }
  }

  onDebugSessionTerminated() {}

  async captureAndStopRecording() {
    const recording = await this.stopRecording();
    await this.utils.saveMultimedia(recording);
  }

  async toggleRecording() {
    if (this.recordingTimeout) {
      this.captureAndStopRecording();
    } else {
      this.startRecording();
    }
  }

  async captureReplay() {
    getTelemetryReporter().sendTelemetryEvent("replay:capture-replay", {
      platform: this.projectState.selectedDevice?.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    const replay = await this.deviceSession.captureReplay();
    this.eventEmitter.emit("replayDataCreated", replay);
  }

  async captureScreenshot() {
    getTelemetryReporter().sendTelemetryEvent("replay:capture-screenshot", {
      platform: this.projectState.selectedDevice?.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }

    const screenshot = await this.deviceSession.captureScreenshot();
    await this.utils.saveMultimedia(screenshot);
  }

  //#endregion

  async dispatchPaste(text: string) {
    await this.deviceSession?.sendClipboard(text);
    await this.utils.showToast("Pasted to device clipboard", 2000);
  }

  async dispatchCopy() {
    const text = await this.deviceSession?.getClipboard();
    if (text) {
      env.clipboard.writeText(text);
    }
    // For consistency between iOS and Android, we always display toast message
    await this.utils.showToast("Copied from device clipboard", 2000);
  }

  async onBundlingError(
    message: string,
    source: DebugSource,
    _errorModulePath: string
  ): Promise<void> {
    await this.deviceSession?.appendDebugConsoleEntry(message, "error", source);

    if (this.projectState.status === "starting") {
      focusSource(source);
    }

    Logger.error("[Bundling Error]", message);

    this.updateProjectState({ status: "bundlingError" });
  }

  onBundleProgress = throttle((stageProgress: number) => {
    this.reportStageProgress(stageProgress, StartupMessage.WaitingForAppToLoad);
  }, 100);

  async getProjectState(): Promise<ProjectState> {
    return this.projectState;
  }

  async addListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ) {
    this.eventEmitter.addListener(eventType, listener);
  }
  async removeListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ) {
    this.eventEmitter.removeListener(eventType, listener);
  }

  public dispose() {
    this.deviceSession?.dispose();
    this.deviceManager.removeListener("deviceRemoved", this.removeDeviceListener);
    this.applicationContext.dispose();
    disposeAll(this.disposables);
  }

  private async reloadMetro() {
    if (await this.deviceSession?.perform("reloadJs")) {
      this.updateProjectState({ status: "running" });
      return true;
    }
    return false;
  }

  public async goHome(homeUrl: string) {
    getTelemetryReporter().sendTelemetryEvent("url-bar:go-home", {
      platform: this.projectState.selectedDevice?.platform,
    });

    if (this.dependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    if (await this.dependencyManager.checkProjectUsesExpoRouter()) {
      await this.openNavigation(homeUrl);
    } else {
      await this.reloadMetro();
    }
  }

  //#region Session lifecycle

  public async reload(type: ReloadAction): Promise<boolean> {
    this.updateProjectState({ status: "starting", startupMessage: StartupMessage.Restarting });

    getTelemetryReporter().sendTelemetryEvent("url-bar:reload-requested", {
      platform: this.projectState.selectedDevice?.platform,
      method: type,
    });

    return await this.deviceSessionsManager.reload(type);
  }

  //#endregion

  async resetAppPermissions(permissionType: AppPermissionType) {
    const needsRestart = await this.deviceSession?.resetAppPermissions(permissionType);
    if (needsRestart) {
      this.reload("restartProcess");
    }
  }

  async getDeepLinksHistory() {
    return extensionContext.workspaceState.get<string[] | undefined>(DEEP_LINKS_HISTORY_KEY) ?? [];
  }

  async openDeepLink(link: string, terminateApp: boolean) {
    const history = await this.getDeepLinksHistory();
    if (history.length === 0 || link !== history[0]) {
      extensionContext.workspaceState.update(
        DEEP_LINKS_HISTORY_KEY,
        [link, ...history.filter((s) => s !== link)].slice(0, DEEP_LINKS_HISTORY_LIMIT)
      );
    }

    this.deviceSession?.sendDeepLink(link, terminateApp);
  }

  public dispatchTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    this.deviceSession?.sendTouches(touches, type);
  }

  public dispatchKeyPress(keyCode: number, direction: "Up" | "Down") {
    this.deviceSession?.sendKey(keyCode, direction);
  }

  public dispatchButton(button: DeviceButtonType, direction: "Up" | "Down") {
    this.deviceSession?.sendButton(button, direction);
  }

  public dispatchWheel(point: TouchPoint, deltaX: number, deltaY: number) {
    this.deviceSession?.sendWheel(point, deltaX, deltaY);
  }

  public async inspectElementAt(
    xRatio: number,
    yRatio: number,
    requestStack: boolean,
    callback: (inspectData: InspectData) => void
  ) {
    this.deviceSession?.inspectElementAt(xRatio, yRatio, requestStack, (inspectData) => {
      let stack = undefined;
      if (requestStack && inspectData?.stack) {
        stack = inspectData.stack;
        const inspectorExcludePattern = workspace
          .getConfiguration("RadonIDE")
          .get("inspectorExcludePattern") as string | undefined;
        const patterns = inspectorExcludePattern?.split(",").map((pattern) => pattern.trim());
        function testInspectorExcludeGlobPattern(filename: string) {
          return patterns?.some((pattern) => minimatch(filename, pattern));
        }
        stack.forEach((item: any) => {
          item.hide = false;
          if (!isAppSourceFile(item.source.fileName)) {
            item.hide = true;
          } else if (testInspectorExcludeGlobPattern(item.source.fileName)) {
            item.hide = true;
          }
        });
      }
      callback({ frame: inspectData.frame, stack });
    });
  }

  public async resumeDebugger() {
    this.deviceSession?.resumeDebugger();
  }

  public async stepOverDebugger() {
    this.deviceSession?.stepOverDebugger();
  }

  public async focusBuildOutput() {
    this.deviceSession?.focusBuildOutput();
  }

  public async focusExtensionLogsOutput() {
    Logger.openOutputPanel();
  }

  public async focusDebugConsole() {
    commands.executeCommand("workbench.panel.repl.view.focus");
  }

  public async openNavigation(navigationItemID: string) {
    this.deviceSession?.openNavigation(navigationItemID);
  }

  public async openDevMenu() {
    await this.deviceSession?.openDevMenu();
  }

  public async activateLicense(activationKey: string) {
    const computerName = os.hostname();
    const activated = await activateDevice(activationKey, computerName);
    return activated;
  }

  public async hasActiveLicense() {
    return !!(await getLicenseToken());
  }

  public async openComponentPreview(fileName: string, lineNumber1Based: number) {
    try {
      const deviceSession = this.deviceSession;
      if (!deviceSession || !deviceSession.isAppLaunched) {
        window.showWarningMessage("Wait for the app to load before launching preview.", "Dismiss");
        return;
      }
      await deviceSession.startPreview(`preview:/${fileName}:${lineNumber1Based}`);
    } catch (e) {
      const relativeFileName = workspace.asRelativePath(fileName, false);
      const message = `Failed to open component preview. Currently previews only work for files loaded by the main application bundle. Make sure that ${relativeFileName} is loaded by your application code.`;
      Logger.error(message);
      window.showErrorMessage(message, "Dismiss");
    }
  }

  public async showStorybookStory(componentTitle: string, storyName: string) {
    if (this.dependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    if (await this.dependencyManager.checkProjectUsesStorybook()) {
      this.deviceSession!.devtools.send("RNIDE_showStorybookStory", { componentTitle, storyName });
    } else {
      window.showErrorMessage("Storybook is not installed.", "Dismiss");
    }
  }

  public async getDeviceSettings() {
    return (
      this.deviceSession?.deviceSettings ?? {
        appearance: "dark",
        contentSize: "normal",
        location: {
          latitude: 50.048653,
          longitude: 19.965474,
          isDisabled: false,
        },
        hasEnrolledBiometrics: false,
        locale: "en_US",
        replaysEnabled: false,
        showTouches: false,
      }
    );
  }

  public async onDeviceSettingChanged(deviceSettings: DeviceSettings) {
    this.eventEmitter.emit("deviceSettingsChanged", deviceSettings);
  }

  public async updateDeviceSettings(settings: DeviceSettings) {
    let needsRestart = await this.deviceSession?.changeDeviceSettings(settings);

    if (needsRestart) {
      await this.reload("reboot");
    }
  }

  onToolsStateChange = (toolsState: ToolsState) => {
    this.eventEmitter.emit("toolsStateChanged", toolsState);
  };

  // frytki !!!!! is wrong here
  public async getToolsState() {
    return this.deviceSession!.toolsManager.getToolsState();
  }

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    await this.deviceSession!.toolsManager.updateToolEnabledState(toolName, enabled);
  }

  public async openTool(toolName: ToolKey) {
    await this.deviceSession!.toolsManager.openTool(toolName);
  }

  public async renameDevice(deviceInfo: DeviceInfo, newDisplayName: string) {
    await this.deviceManager.renameDevice(deviceInfo, newDisplayName);
    deviceInfo.displayName = newDisplayName;
    if (this.projectState.selectedDevice?.id === deviceInfo.id) {
      this.updateProjectState({ selectedDevice: deviceInfo });
    }
  }

  public async runCommand(command: string): Promise<void> {
    await commands.executeCommand(command);
  }

  public async sendBiometricAuthorization(isMatch: boolean) {
    await this.deviceSession?.sendBiometricAuthorization(isMatch);
  }

  private reportStageProgress(stageProgress: number, stage: string) {
    if (stage !== this.projectState.startupMessage) {
      return;
    }
    this.updateProjectState({ stageProgress });
  }

  private updateProjectState(newState: Partial<ProjectState>) {
    // NOTE: this is unsafe, but I'm not sure there's a way to enforce the type of `newState` correctly
    const mergedState: any = { ...this.projectState, ...newState };
    // stageProgress is tied to a startup stage, so when there is a change of status or startupMessage,
    // we always want to reset the progress.
    if (
      newState.status !== undefined ||
      ("startupMessage" in newState && newState.startupMessage !== undefined)
    ) {
      delete mergedState.stageProgress;
    }
    this.projectState = mergedState;
    this.eventEmitter.emit("projectStateChanged", this.projectState);
  }

  private updateProjectStateForDevice(id: string, newState: Partial<ProjectState>) {
    if (id === this.projectState.selectedDevice?.id) {
      this.updateProjectState(newState);
    }
  }

  public async updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void> {
    this.updateProjectState({ previewZoom: zoom });
    extensionContext.workspaceState.update(PREVIEW_ZOOM_KEY, zoom);
  }

  public async ensureDependenciesAndNodeVersion() {
    if (this.dependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    const installed = await this.dependencyManager.checkNodeModulesInstallationStatus();

    if (!installed) {
      Logger.info("Installing node modules");
      await this.dependencyManager.installNodeModules();
      Logger.debug("Installing node modules succeeded");
    } else {
      Logger.debug("Node modules already installed - skipping");
    }

    const supportedNodeInstalled =
      await this.dependencyManager.checkSupportedNodeVersionInstalled();
    if (!supportedNodeInstalled) {
      throw new Error(
        "Node.js was not found, or the version in the PATH does not satisfy minimum version requirements."
      );
    }
  }

  //#region Select device
  public async selectDevice(deviceInfo: DeviceInfo, selectDeviceOptions?: SelectDeviceOptions) {
    const device = await this.deviceSessionsManager.selectDevice(deviceInfo, selectDeviceOptions);
    if (!device) {
      return false;
    }
    this.updateProjectState({ selectedDevice: deviceInfo });
    return true;
  }

  //#endregion

  // used in callbacks, needs to be an arrow function
  private removeDeviceListener = async (device: DeviceInfo) => {
    if (this.projectState.selectedDevice?.id === device.id) {
      this.updateProjectState({ status: "starting" });
      await this.deviceSessionsManager.trySelectingDevice();
    }
  };
}

export function isAppSourceFile(filePath: string) {
  const relativeToWorkspace = workspace.asRelativePath(filePath, false);

  if (relativeToWorkspace === filePath) {
    // when path is outside of any workspace folder, workspace.asRelativePath returns the original path
    return false;
  }

  // if the relative path contain node_modules, we assume it's not user's app source file:
  return !relativeToWorkspace.includes("node_modules");
}
