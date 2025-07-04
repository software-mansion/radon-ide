import { EventEmitter } from "stream";
import os from "os";
import path from "path";
import assert from "assert";
import { env, Disposable, commands, workspace, window } from "vscode";
import _ from "lodash";
import { minimatch } from "minimatch";
import {
  AppPermissionType,
  DeviceButtonType,
  DeviceSessionsManagerState,
  DeviceSessionState,
  DeviceSettings,
  InspectData,
  ProjectEventListener,
  ProjectEventMap,
  ProjectInterface,
  ProjectState,
  ToolsState,
  TouchPoint,
  ZoomLevelType,
} from "../common/Project";
import { Logger } from "../Logger";
import { DeviceInfo } from "../common/DeviceManager";
import { DeviceManager } from "../devices/DeviceManager";
import { extensionContext } from "../utilities/extensionContext";
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
import { DeviceSessionsManager, DeviceSessionsManagerDelegate } from "./DeviceSessionsManager";
import { DEVICE_SETTINGS_DEFAULT, DEVICE_SETTINGS_KEY } from "../devices/DeviceBase";
import { FingerprintProvider } from "./FingerprintProvider";
import { BuildCache } from "../builders/BuildCache";
import {
  launchConfigurationFromOptions,
  LaunchConfigurationsManager,
} from "./launchConfigurationsManager";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";

const PREVIEW_ZOOM_KEY = "preview_zoom";
const DEEP_LINKS_HISTORY_KEY = "deep_links_history";

const DEEP_LINKS_HISTORY_LIMIT = 50;

const MAX_RECORDING_TIME_SEC = 10 * 60; // 10 minutes

export class Project implements Disposable, ProjectInterface, DeviceSessionsManagerDelegate {
  private launchConfigsManager = new LaunchConfigurationsManager();
  private applicationContext: ApplicationContext;
  private eventEmitter = new EventEmitter();

  public deviceSessionsManager: DeviceSessionsManager;

  private projectState: ProjectState;

  private disposables: Disposable[] = [];

  public get deviceSession() {
    return this.deviceSessionsManager.selectedDeviceSession;
  }

  constructor(
    private readonly deviceManager: DeviceManager,
    private readonly utils: UtilsInterface
  ) {
    const fingerprintProvider = new FingerprintProvider();
    const buildCache = new BuildCache(fingerprintProvider);
    const initialLaunchConfig = this.launchConfigsManager.launchConfigurations[0];
    this.applicationContext = new ApplicationContext(initialLaunchConfig, buildCache);
    this.deviceSessionsManager = new DeviceSessionsManager(
      this.applicationContext,
      this.deviceManager,
      this
    );

    this.projectState = {
      selectedSessionId: null,
      deviceSessions: {},
      initialized: false,
      appRootPath: this.relativeAppRootPath,
      previewZoom: undefined,
      selectedLaunchConfiguration: initialLaunchConfig,
      customLaunchConfigurations: this.launchConfigsManager.launchConfigurations,
    };

    this.disposables.push(fingerprintProvider);
    this.disposables.push(refreshTokenPeriodically());
    this.disposables.push(
      watchLicenseTokenChange(async () => {
        const hasActiveLicense = await this.hasActiveLicense();
        this.eventEmitter.emit("licenseActivationChanged", hasActiveLicense);
      })
    );
    this.disposables.push(
      this.launchConfigsManager.onLaunchConfigurationsChanged((launchConfigs) => {
        this.updateProjectState({
          customLaunchConfigurations: launchConfigs,
        });
        const selectedLaunchConfig =
          launchConfigs[0] ?? launchConfigurationFromOptions({ appRoot: this.relativeAppRootPath });

        const oldAppRoot = this.applicationContext.appRootFolder;
        if (selectedLaunchConfig.absoluteAppRoot !== oldAppRoot) {
          // If the app root has changed, we need to update the application context
          this.setLaunchConfiguration(selectedLaunchConfig);
        } else {
          this.applicationContext.updateLaunchConfig(selectedLaunchConfig);
          this.updateProjectState({
            selectedLaunchConfiguration: selectedLaunchConfig,
          });
        }
      })
    );
  }

  async setLaunchConfiguration(options: LaunchConfigurationOptions): Promise<void> {
    const launchConfig = launchConfigurationFromOptions(options);
    if (_.isEqual(launchConfig, this.applicationContext.launchConfig)) {
      // No change in launch configuration, nothing to do
      return;
    }
    await this.applicationContext.updateLaunchConfig(launchConfig);
    const oldDeviceSessionsManager = this.deviceSessionsManager;
    this.deviceSessionsManager = new DeviceSessionsManager(
      this.applicationContext,
      this.deviceManager,
      this
    );
    oldDeviceSessionsManager.dispose();
    this.updateProjectState({
      appRootPath: this.relativeAppRootPath,
      selectedLaunchConfiguration: launchConfig,
    });
  }

  onDeviceSessionsManagerStateChange(state: DeviceSessionsManagerState): void {
    this.updateProjectState(state);
  }

  get relativeAppRootPath() {
    const relativePath = workspace.asRelativePath(this.applicationContext.appRootFolder);
    if (relativePath === this.applicationContext.appRootFolder) {
      return "./";
    }
    if (relativePath.startsWith(".." + path.sep) || relativePath.startsWith("." + path.sep)) {
      return relativePath;
    }
    return `.${path.sep}${relativePath}`;
  }

  get appRootFolder() {
    return this.applicationContext.appRootFolder;
  }

  get dependencyManager() {
    return this.applicationContext.dependencyManager;
  }

  get launchConfig() {
    return this.applicationContext.launchConfigurationController;
  }

  get buildCache() {
    return this.applicationContext.buildCache;
  }

  private get selectedDeviceSessionState(): DeviceSessionState | undefined {
    if (this.projectState.selectedSessionId === null) {
      return undefined;
    }
    const selectedSessionState =
      this.projectState.deviceSessions[this.projectState.selectedSessionId];
    assert(selectedSessionState !== undefined, "Expected the selected session to exist");
    return selectedSessionState;
  }

  private async setupAppRoot() {}

  onInitialized(): void {
    this.updateProjectState({ initialized: true });
  }

  private recordingTimeout: NodeJS.Timeout | undefined = undefined;

  startRecording(): void {
    getTelemetryReporter().sendTelemetryEvent("recording:start-recording", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.startRecording();

    this.recordingTimeout = setTimeout(() => {
      this.stopRecording();
    }, MAX_RECORDING_TIME_SEC * 1000);
  }

  private async stopRecording() {
    clearTimeout(this.recordingTimeout);

    getTelemetryReporter().sendTelemetryEvent("recording:stop-recording", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
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

  async startProfilingReact() {
    await this.deviceSession?.startProfilingReact();
  }

  async stopProfilingReact() {
    const uri = await this.deviceSession?.stopProfilingReact();
    if (uri) {
      // open profile file in vscode using our custom editor
      commands.executeCommand("vscode.open", uri);
    }
  }

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
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    const replay = await this.deviceSession.captureReplay();
    this.eventEmitter.emit("replayDataCreated", replay);
  }

  async captureScreenshot() {
    getTelemetryReporter().sendTelemetryEvent("replay:capture-screenshot", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
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
    this.applicationContext.dispose();
    disposeAll(this.disposables);
  }

  private async reloadMetro() {
    if (await this.deviceSession?.performReloadAction("reloadJs")) {
      return true;
    }
    return false;
  }

  public async navigateHome() {
    getTelemetryReporter().sendTelemetryEvent("url-bar:go-home", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });

    if (this.dependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    if (await this.dependencyManager.checkProjectUsesExpoRouter()) {
      await this.deviceSession?.navigateHome();
    } else {
      await this.reloadMetro();
    }
  }

  public async removeNavigationHistoryEntry(id: string): Promise<void> {
    this.deviceSession?.removeNavigationHistoryEntry(id);
  }

  async resetAppPermissions(permissionType: AppPermissionType) {
    const needsRestart = await this.deviceSession?.resetAppPermissions(permissionType);
    if (needsRestart) {
      await this.deviceSessionsManager.reloadCurrentSession("restartProcess");
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
    this.deviceSession?.resetLogCounter();
    commands.executeCommand("workbench.panel.repl.view.focus");
  }

  public async openNavigation(navigationItemID: string) {
    this.deviceSession?.openNavigation(navigationItemID);
  }

  public async navigateBack() {
    this.deviceSession?.navigateBack();
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
      if (!deviceSession) {
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
      this.deviceSession?.openStorybookStory(componentTitle, storyName);
    } else {
      window.showErrorMessage("Storybook is not installed.", "Dismiss");
    }
  }

  public async getDeviceSettings() {
    return extensionContext.workspaceState.get(DEVICE_SETTINGS_KEY, DEVICE_SETTINGS_DEFAULT);
  }

  public async updateDeviceSettings(settings: DeviceSettings) {
    const currentSession = this.deviceSession;
    if (currentSession) {
      let needsRestart = await currentSession.updateDeviceSettings(settings);
      this.eventEmitter.emit("deviceSettingsChanged", settings);

      if (needsRestart) {
        await this.deviceSessionsManager.reloadCurrentSession("reboot");
      }
    }
  }

  onToolsStateChange = (toolsState: ToolsState) => {
    this.eventEmitter.emit("toolsStateChanged", toolsState);
  };

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    await this.deviceSession?.updateToolEnabledState(toolName, enabled);
  }

  public async openTool(toolName: ToolKey) {
    await this.deviceSession?.openTool(toolName);
  }

  public async renameDevice(deviceInfo: DeviceInfo, newDisplayName: string) {
    await this.deviceManager.renameDevice(deviceInfo, newDisplayName);
    deviceInfo.displayName = newDisplayName;
    // NOTE: this should probably be handled via some listener on Device instead:
    const deviceId = deviceInfo.id;
    if (!(deviceId in this.projectState.deviceSessions)) {
      return;
    }
    const newDeviceState = {
      ...this.projectState.deviceSessions[deviceId],
      deviceInfo,
    };
    const newDeviceSessions = {
      ...this.projectState.deviceSessions,
      [deviceId]: newDeviceState,
    };
    this.updateProjectState({ deviceSessions: newDeviceSessions });
  }

  public async runCommand(command: string): Promise<void> {
    await commands.executeCommand(command);
  }

  public async sendBiometricAuthorization(isMatch: boolean) {
    await this.deviceSession?.sendBiometricAuthorization(isMatch);
  }

  private updateProjectState(newState: Partial<ProjectState>) {
    const mergedState = { ...this.projectState, ...newState };
    this.projectState = mergedState;
    this.eventEmitter.emit("projectStateChanged", this.projectState);
  }

  public async updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void> {
    this.updateProjectState({ previewZoom: zoom });
    extensionContext.workspaceState.update(PREVIEW_ZOOM_KEY, zoom);
  }
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
