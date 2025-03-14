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
import { isEqual } from "lodash";
import {
  AppPermissionType,
  DeviceSettings,
  InspectData,
  ProjectEventListener,
  ProjectEventMap,
  ProjectInterface,
  ProjectState,
  ReloadAction,
  StartupMessage,
  TouchPoint,
  ZoomLevelType,
} from "../common/Project";
import { Logger } from "../Logger";
import { DeviceInfo } from "../common/DeviceManager";
import { DeviceAlreadyUsedError, DeviceManager } from "../devices/DeviceManager";
import { extensionContext, getCurrentLaunchConfig } from "../utilities/extensionContext";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { throttle, throttleAsync } from "../utilities/throttle";
import { DebugSessionDelegate, DebugSource } from "../debugging/DebugSession";
import { Metro, MetroDelegate } from "./metro";
import { Devtools } from "./devtools";
import { AppEvent, DeviceBootError, DeviceSession, EventDelegate } from "./deviceSession";
import { PanelLocation } from "../common/WorkspaceConfig";
import {
  activateDevice,
  watchLicenseTokenChange,
  getLicenseToken,
  refreshTokenPeriodically,
} from "../utilities/license";
import { getTelemetryReporter } from "../utilities/telemetry";
import { ToolKey, ToolsManager } from "./tools";
import { UtilsInterface } from "../common/utils";
import { ApplicationContext } from "./ApplicationContext";
import { disposeAll } from "../utilities/disposables";
import { findAndSetupNewAppRootFolder } from "../utilities/findAndSetupNewAppRootFolder";
import { focusSource } from "../utilities/focusSource";

const DEVICE_SETTINGS_KEY = "device_settings_v4";

const LAST_SELECTED_DEVICE_KEY = "last_selected_device";
const PREVIEW_ZOOM_KEY = "preview_zoom";
const DEEP_LINKS_HISTORY_KEY = "deep_links_history";

const DEEP_LINKS_HISTORY_LIMIT = 50;

const FINGERPRINT_THROTTLE_MS = 10 * 1000; // 10 seconds

const MAX_RECORDING_TIME_SEC = 10 * 60; // 10 minutes

export class Project
  implements Disposable, MetroDelegate, EventDelegate, DebugSessionDelegate, ProjectInterface
{
  private applicationContext: ApplicationContext;

  public metro: Metro;
  public toolsManager: ToolsManager;

  private devtools;
  private eventEmitter = new EventEmitter();
  private isCachedBuildStale: boolean;

  private deviceSession: DeviceSession | undefined;

  private projectState: ProjectState = {
    status: "starting",
    previewURL: undefined,
    previewZoom: extensionContext.workspaceState.get(PREVIEW_ZOOM_KEY),
    selectedDevice: undefined,
    initialized: false,
  };

  private deviceSettings: DeviceSettings;

  private disposables: Disposable[] = [];

  constructor(
    private readonly deviceManager: DeviceManager,
    private readonly utils: UtilsInterface
  ) {
    const appRoot = findAndSetupNewAppRootFolder();
    this.applicationContext = new ApplicationContext(appRoot);

    this.deviceSettings = extensionContext.workspaceState.get(DEVICE_SETTINGS_KEY) ?? {
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
    };

    this.devtools = new Devtools();
    this.metro = new Metro(this.devtools, this);
    this.start(false, false);
    this.trySelectingInitialDevice();
    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);
    this.isCachedBuildStale = false;
    this.toolsManager = new ToolsManager(this.devtools, this.eventEmitter);

    this.disposables.push(this.toolsManager);
    this.disposables.push(
      watchProjectFiles(() => {
        this.checkIfNativeChanged();
      })
    );
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
          const config = getCurrentLaunchConfig();
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

    this.reload("reboot");
  }

  //#region Build progress
  onBuildProgress = (stageProgress: number): void => {
    this.reportStageProgress(stageProgress, StartupMessage.Building);
  };

  onBuildSuccess = (): void => {
    // reset fingerprint change flag when build finishes successfully
    this.isCachedBuildStale = false;
  };

  onStateChange = (state: StartupMessage): void => {
    this.updateProjectStateForDevice(this.projectState.selectedDevice!, { startupMessage: state });
  };
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
        const ignoredEvents = ["starting", "bundlingError", "runtimeError"];
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
    if (event.body?.reason === "exception") {
      // if we know that incremental bundle error happened, we don't want to change the status
      if (this.projectState.status === "bundlingError") {
        return;
      }
      this.updateProjectState({ status: "runtimeError" });
    } else {
      this.updateProjectState({ status: "debuggerPaused" });
    }

    // we don't want to focus on debug side panel if it means hiding Radon IDE
    const panelLocation = workspace
      .getConfiguration("RadonIDE")
      .get<PanelLocation>("panelLocation");

    if (panelLocation === "tab") {
      commands.executeCommand("workbench.view.debug");
    }
  }

  onDebuggerResumed() {
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

  onBundleBuildFailedError(): void {
    this.updateProjectState({ status: "bundleBuildFailedError" });
  }

  async onBundlingError(
    message: string,
    source: DebugSource,
    _errorModulePath: string
  ): Promise<void> {
    await this.deviceSession?.appendDebugConsoleEntry(message, "error", source);

    this.focusDebugConsole();
    focusSource(source);

    Logger.error("[Bundling Error]", message);
    // if bundle build failed, we don't want to change the status
    // bundlingError status should be set only when bundleBuildFailedError status is not set
    if (this.projectState.status === "bundleBuildFailedError") {
      return;
    }
    this.updateProjectState({ status: "bundlingError" });
  }

  /**
   * This method tried to select the last selected device from devices list.
   * If the device list is empty, we wait until we can select a device.
   */
  private async trySelectingInitialDevice() {
    const selectInitialDevice = async (devices: DeviceInfo[]) => {
      // we try to pick the last selected device that we saved in the persistent state, otherwise
      // we take the first device from the list
      const lastDeviceId = extensionContext.workspaceState.get<string | undefined>(
        LAST_SELECTED_DEVICE_KEY
      );
      const device = devices.find(({ id }) => id === lastDeviceId) ?? devices.at(0);

      if (device) {
        // if we found a device on the devices list, we try to select it
        const isDeviceSelected = await this.selectDevice(device);
        if (isDeviceSelected) {
          return true;
        }
      }

      // if device selection wasn't successful we will retry it later on when devicesChange
      // event is emitted (i.e. when user create a new device). We also make sure that the
      // device selection is cleared in the project state:
      this.updateProjectState({
        selectedDevice: undefined,
        initialized: true, // when no device can be selected, we consider the project initialized
      });
      // when we reach this place, it means there's no device that we can select, we
      // wait for the new device to be added to the list:
      const listener = async (newDevices: DeviceInfo[]) => {
        this.deviceManager.removeListener("devicesChanged", listener);
        if (this.projectState.selectedDevice) {
          // device was selected in the meantime, we don't need to do anything
          return;
        } else if (isEqual(newDevices, devices)) {
          // list is the same, we register listener to wait for the next change
          this.deviceManager.addListener("devicesChanged", listener);
        } else {
          selectInitialDevice(newDevices);
        }
      };

      // we trigger initial listener call with the most up to date list of devices
      listener(await this.deviceManager.listAllDevices());

      return false;
    };

    const devices = await this.deviceManager.listAllDevices();
    await selectInitialDevice(devices);
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
    this.metro?.dispose();
    this.devtools?.dispose();
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
  public async restart(
    clean: "all" | "metro" | false,
    onlyReloadJSWhenPossible: boolean = true,
    restartDevice: boolean = false
  ) {
    getTelemetryReporter().sendTelemetryEvent("url-bar:restart-requested", {
      platform: this.projectState.selectedDevice?.platform,
    });

    // we save device info and device session at the start such that we can
    // check if they weren't updated in the meantime while we await for restart
    // procedures
    const deviceInfo = this.projectState.selectedDevice!;
    const deviceSession = this.deviceSession;

    this.updateProjectStateForDevice(deviceInfo, {
      status: "starting",
      startupMessage: StartupMessage.Restarting,
    });

    // we first consider forceCleanBuild flag, if set we always perform a clean
    // start of the project and select the device
    if (clean) {
      await this.start(true, true);
      await this.selectDevice(deviceInfo, clean === "all");
      return;
    }

    // Otherwise, depending on the project state we try deviceSelection, or
    // only relad JS if possible.
    try {
      if (restartDevice || this.isCachedBuildStale) {
        await this.selectDevice(deviceInfo, false);
        return;
      }

      if (onlyReloadJSWhenPossible) {
        // if reloading JS is possible, we try to do it first and exit in case of success
        // otherwise we continue to restart using more invasive methods
        if (await this.reloadMetro()) {
          return;
        }
      }

      // we first check if the device session hasn't changed in the meantime
      if (deviceSession === this.deviceSession) {
        const restartSucceeded = await this.deviceSession?.perform("restartProcess");
        if (restartSucceeded) {
          this.updateProjectStateForDevice(deviceInfo, {
            status: "running",
          });
        }
      }
    } catch (e) {
      // finally in case of any errors, the last resort is performing project
      // restart and device selection (we still avoid forcing clean builds, and
      // only do clean build when explicitly requested).
      // before doing anything, we check if the device hasn't been updated in the meantime
      // which might have initiated a new session anyway
      if (deviceInfo === this.projectState.selectedDevice) {
        await this.start(true, false);
        await this.selectDevice(deviceInfo, false);
      }
    }
  }

  public async reload(type: ReloadAction): Promise<boolean> {
    this.updateProjectState({ status: "starting", startupMessage: StartupMessage.Restarting });

    getTelemetryReporter().sendTelemetryEvent("url-bar:reload-requested", {
      platform: this.projectState.selectedDevice?.platform,
      method: type,
    });

    // this action needs to be handled outside of device session as it resets the device session itself
    if (type === "reboot") {
      const deviceInfo = this.projectState.selectedDevice!;
      await this.start(true, false);
      await this.selectDevice(deviceInfo);
      return true;
    }

    const success = (await this.deviceSession?.perform(type)) ?? false;
    if (success) {
      this.updateProjectState({ status: "running" });
    } else {
      window.showErrorMessage("Failed to reload, you may try another reload option.", "Dismiss");
    }
    return success;
  }

  private async start(restart: boolean, resetMetroCache: boolean) {
    if (this.appRootFolder === undefined) {
      Logger.error("[PROJECT] App root folder not initialized. this code should be unreachable.");
      throw new Error("[PROJECT] App root folder not initialized");
    }
    if (restart) {
      const oldDevtools = this.devtools;
      const oldMetro = this.metro;
      const oldToolsManager = this.toolsManager;
      this.devtools = new Devtools();
      this.metro = new Metro(this.devtools, this);
      this.toolsManager = new ToolsManager(this.devtools, this.eventEmitter);
      oldToolsManager.dispose();
      oldDevtools.dispose();
      oldMetro.dispose();
    }

    const waitForNodeModules = this.ensureDependenciesAndNodeVersion();

    Logger.debug(`Launching devtools`);
    this.devtools.start();

    Logger.debug(`Launching metro`);
    this.metro.start(
      resetMetroCache,
      throttle((stageProgress: number) => {
        this.reportStageProgress(stageProgress, StartupMessage.WaitingForAppToLoad);
      }, 100),
      [waitForNodeModules],
      this.appRootFolder
    );
  }
  //#endregion

  async resetAppPermissions(permissionType: AppPermissionType) {
    const needsRestart = await this.deviceSession?.resetAppPermissions(permissionType);
    if (needsRestart) {
      this.restart(false, false);
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
      this.devtools.send("RNIDE_showStorybookStory", { componentTitle, storyName });
    } else {
      window.showErrorMessage("Storybook is not installed.", "Dismiss");
    }
  }

  public async getDeviceSettings() {
    return this.deviceSettings;
  }

  public async updateDeviceSettings(settings: DeviceSettings) {
    const changedSettings = (Object.keys(settings) as Array<keyof DeviceSettings>).filter(
      (settingKey) => {
        return !_.isEqual(settings[settingKey], this.deviceSettings[settingKey]);
      }
    );
    getTelemetryReporter().sendTelemetryEvent("device-settings:update-device-settings", {
      platform: this.projectState.selectedDevice?.platform,
      changedSetting: JSON.stringify(changedSettings),
    });
    this.deviceSettings = settings;
    extensionContext.workspaceState.update(DEVICE_SETTINGS_KEY, settings);
    let needsRestart = await this.deviceSession?.changeDeviceSettings(settings);
    this.eventEmitter.emit("deviceSettingsChanged", this.deviceSettings);

    if (needsRestart) {
      await this.restart(false, false, true);
    }
  }

  public async getToolsState() {
    return this.toolsManager.getToolsState();
  }

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    await this.toolsManager.updateToolEnabledState(toolName, enabled);
  }

  public async openTool(toolName: ToolKey) {
    await this.toolsManager.openTool(toolName);
  }

  public async renameDevice(deviceInfo: DeviceInfo, newDisplayName: string) {
    await this.deviceManager.renameDevice(deviceInfo, newDisplayName);
    deviceInfo.displayName = newDisplayName;
    if (this.projectState.selectedDevice?.id === deviceInfo.id) {
      this.updateProjectState({ selectedDevice: deviceInfo });
    }
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
    // stageProgress is tied to a startup stage, so when there is a change of status or startupMessage,
    // we always want to reset the progress.
    if (newState.status !== undefined || newState.startupMessage !== undefined) {
      delete this.projectState.stageProgress;
    }
    this.projectState = { ...this.projectState, ...newState };
    this.eventEmitter.emit("projectStateChanged", this.projectState);
  }

  private updateProjectStateForDevice(deviceInfo: DeviceInfo, newState: Partial<ProjectState>) {
    if (deviceInfo === this.projectState.selectedDevice) {
      this.updateProjectState(newState);
    }
  }

  public async updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void> {
    this.updateProjectState({ previewZoom: zoom });
    extensionContext.workspaceState.update(PREVIEW_ZOOM_KEY, zoom);
  }

  private async ensureDependenciesAndNodeVersion() {
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

    await this.dependencyManager.validateNodeVersion();
  }

  //#region Select device
  private async selectDeviceOnly(deviceInfo: DeviceInfo) {
    if (!deviceInfo.available) {
      window.showErrorMessage(
        "Selected device is not available. Perhaps the system image it uses is not installed. Please select another device.",
        "Dismiss"
      );
      return undefined;
    }
    let device: IosSimulatorDevice | AndroidEmulatorDevice | undefined;
    try {
      device = await this.deviceManager.acquireDevice(deviceInfo);
    } catch (e) {
      if (e instanceof DeviceAlreadyUsedError) {
        window.showErrorMessage(
          "This device is already used by other instance of Radon IDE.\nPlease select another device",
          "Dismiss"
        );
      } else {
        Logger.error(`Couldn't acquire the device ${deviceInfo.platform} – ${deviceInfo.id}`, e);
      }
    }

    if (device) {
      Logger.debug("Device selected", deviceInfo.displayName);
      extensionContext.workspaceState.update(LAST_SELECTED_DEVICE_KEY, deviceInfo.id);
      return device;
    }
    return undefined;
  }

  public async selectDevice(deviceInfo: DeviceInfo, forceCleanBuild = false) {
    if (this.dependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }
    if (this.appRootFolder === undefined) {
      Logger.error("[PROJECT] App root folder not initialized. this code should be unreachable.");
      throw new Error("[PROJECT] App root folder not initialized");
    }
    if (this.buildCache === undefined) {
      Logger.error(
        "[PROJECT] Build cache folder not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Build cache not initialized");
    }

    const device = await this.selectDeviceOnly(deviceInfo);
    if (!device) {
      return false;
    }
    Logger.debug("Selected device is ready");

    await this.deviceSession?.dispose();
    this.deviceSession = undefined;

    this.updateProjectState({
      selectedDevice: deviceInfo,
      initialized: true,
      status: "starting",
      startupMessage: StartupMessage.InitializingDevice,
      previewURL: undefined,
    });

    let newDeviceSession;
    try {
      newDeviceSession = new DeviceSession(
        device,
        this.devtools,
        this.metro,
        this.dependencyManager,
        this.buildCache,
        this,
        this
      );
      this.deviceSession = newDeviceSession;

      const previewURL = await newDeviceSession.start(this.deviceSettings, this.appRootFolder, {
        cleanBuild: forceCleanBuild,
        previewReadyCallback: (url) => {
          this.updateProjectStateForDevice(deviceInfo, { previewURL: url });
        },
      });
      this.updateProjectStateForDevice(this.projectState.selectedDevice!, {
        previewURL,
        status: "running",
      });
    } catch (e) {
      Logger.error("Couldn't start device session", e);

      const isSelected = this.projectState.selectedDevice === deviceInfo;
      const isNewSession = this.deviceSession === newDeviceSession;
      if (isSelected && isNewSession) {
        if (e instanceof DeviceBootError) {
          this.updateProjectState({ status: "bootError" });
        } else {
          this.updateProjectState({ status: "buildError" });
        }
      }
    }
    return true;
  }
  //#endregion

  // used in callbacks, needs to be an arrow function
  private removeDeviceListener = async (device: DeviceInfo) => {
    if (this.projectState.selectedDevice?.id === device.id) {
      this.updateProjectState({ status: "starting" });
      await this.trySelectingInitialDevice();
    }
  };

  private checkIfNativeChanged = throttleAsync(async () => {
    if (!this.isCachedBuildStale && this.deviceSession) {
      const isCacheStale =
        !this.projectState.selectedDevice ||
        (await this.deviceSession.buildCache.isCacheStale(
          this.projectState.selectedDevice.platform
        ));

      if (isCacheStale) {
        this.isCachedBuildStale = true;
        this.eventEmitter.emit("needsNativeRebuild");
      }
    }
  }, FINGERPRINT_THROTTLE_MS);
}

function watchProjectFiles(onChange: () => void) {
  // VS code glob patterns don't support negation so we can't exclude
  // native build directories like android/build, android/.gradle,
  // android/app/build, or ios/build.
  // VS code by default exclude .git and node_modules directories from
  // watching, configured by `files.watcherExclude` setting.
  //
  // We may revisit this if better performance is needed and create
  // recursive watches ourselves by iterating through workspace directories
  // to workaround this issue.

  const savedFileWatcher = workspace.onDidSaveTextDocument(onChange);

  const watcher = workspace.createFileSystemWatcher("**/*");
  watcher.onDidChange(onChange);
  watcher.onDidCreate(onChange);
  watcher.onDidDelete(onChange);

  return {
    dispose: () => {
      watcher.dispose();
      savedFileWatcher.dispose();
    },
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
