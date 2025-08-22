import { EventEmitter } from "stream";
import os from "os";
import path from "path";
import assert from "assert";
import { env, Disposable, commands, workspace, window } from "vscode";
import _ from "lodash";
import { TelemetryEventProperties } from "@vscode/extension-telemetry";
import {
  AppPermissionType,
  DeviceButtonType,
  DeviceId,
  DeviceRotation,
  DeviceSessionsManagerState,
  DeviceSessionState,
  DeviceSettings,
  IDEPanelMoveTarget,
  isOfEnumDeviceRotation,
  ProjectEventListener,
  ProjectEventMap,
  ProjectInterface,
  ProjectState,
  ToolsState,
  TouchPoint,
} from "../common/Project";
import { AppRootConfigController } from "../panels/AppRootConfigController";
import { Logger } from "../Logger";
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
import { ApplicationContext } from "./ApplicationContext";
import { disposeAll } from "../utilities/disposables";
import {
  DeviceSessionsManager,
  DeviceSessionsManagerDelegate,
  ReloadAction,
  SelectDeviceOptions,
} from "./DeviceSessionsManager";
import { DEVICE_SETTINGS_DEFAULT, DEVICE_SETTINGS_KEY } from "../devices/DeviceBase";
import { FingerprintProvider } from "./FingerprintProvider";
import { Connector } from "../connect/Connector";
import { LaunchConfigurationsManager } from "./launchConfigurationsManager";
import { LaunchConfiguration } from "../common/LaunchConfig";
import { OutputChannelRegistry } from "./OutputChannelRegistry";
import { Output } from "../common/OutputChannel";
import { StateManager } from "./StateManager";
import {
  AndroidSystemImageInfo,
  DeviceInfo,
  DevicesState,
  IOSDeviceTypeInfo,
  IOSRuntimeInfo,
  MultimediaData,
  ProjectStore,
  WorkspaceConfiguration,
} from "../common/State";
import { EnvironmentDependencyManager } from "../dependency/EnvironmentDependencyManager";
import { Telemetry } from "./telemetry";
import { EditorBindings } from "./EditorBindings";
import { saveMultimedia } from "../utilities/saveMultimedia";

const DEEP_LINKS_HISTORY_KEY = "deep_links_history";

const DEEP_LINKS_HISTORY_LIMIT = 50;

export class Project implements Disposable, ProjectInterface, DeviceSessionsManagerDelegate {
  // #region Properties

  // #region Properties

  private launchConfigsManager = new LaunchConfigurationsManager();
  private applicationContext: ApplicationContext;
  private eventEmitter = new EventEmitter();

  public deviceSessionsManager: DeviceSessionsManager;

  private projectState: ProjectState;
  private selectedLaunchConfiguration: LaunchConfiguration;

  private disposables: Disposable[] = [];

  public readonly appRootConfigController: AppRootConfigController = new AppRootConfigController();

  public get deviceSession() {
    return this.deviceSessionsManager.selectedDeviceSession;
  }

  // #endregion Properties

  // #region Getters

  public get relativeAppRootPath() {
    const relativePath = workspace.asRelativePath(this.applicationContext.appRootFolder);
    if (relativePath === this.applicationContext.appRootFolder) {
      return "./";
    }
    if (relativePath.startsWith(".." + path.sep) || relativePath.startsWith("." + path.sep)) {
      return relativePath;
    }
    return `.${path.sep}${relativePath}`;
  }

  public get appRootFolder() {
    return this.applicationContext.appRootFolder;
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

  public async getProjectState(): Promise<ProjectState> {
    return this.projectState;
  }

  // #endregion Getters

  // #region Constructor

  constructor(
    private readonly stateManager: StateManager<ProjectStore>,
    private readonly workspaceStateManager: StateManager<WorkspaceConfiguration>,
    private readonly devicesStateManager: StateManager<DevicesState>,
    private readonly deviceManager: DeviceManager,
    private readonly editorBindings: EditorBindings,
    private readonly outputChannelRegistry: OutputChannelRegistry,
    private readonly environmentDependencyManager: EnvironmentDependencyManager,
    private readonly telemetry: Telemetry,
    initialLaunchConfigOptions?: LaunchConfiguration
  ) {
    const fingerprintProvider = new FingerprintProvider();
    const initialLaunchConfig = initialLaunchConfigOptions
      ? initialLaunchConfigOptions
      : this.launchConfigsManager.initialLaunchConfiguration;
    this.selectedLaunchConfiguration = initialLaunchConfig;
    this.applicationContext = new ApplicationContext(
      this.stateManager.getDerived("applicationContext"),
      workspaceStateManager,
      initialLaunchConfig,
      fingerprintProvider
    );
    this.deviceSessionsManager = new DeviceSessionsManager(
      this.stateManager.getDerived("deviceSessions"),
      this.stateManager,
      this.applicationContext,
      this.deviceManager,
      this.devicesStateManager,
      this,
      this.outputChannelRegistry
    );

    const connector = Connector.getInstance();

    this.projectState = {
      selectedSessionId: null,
      deviceSessions: {},
      appRootPath: this.relativeAppRootPath,
      selectedLaunchConfiguration: this.selectedLaunchConfiguration,
      customLaunchConfigurations: this.launchConfigsManager.launchConfigurations,
      connectState: {
        enabled: connector.isEnabled,
        connected: connector.isConnected,
      },
    };

    this.maybeStartInitialDeviceSession();

    this.disposables.push(
      connector.onConnectStateChanged((connectState) => {
        this.updateProjectState({ connectState });
        if (connectState.enabled) {
          this.deviceSessionsManager.terminateAllSessions();
        }
      })
    );

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
      })
    );
    this.disposables.push(
      this.workspaceStateManager.onSetState(
        (partialWorkspaceConfig: Partial<WorkspaceConfiguration>) => {
          const deviceRotation = partialWorkspaceConfig.deviceRotation;
          if (!deviceRotation) {
            return;
          }

          const deviceRotationResult = isOfEnumDeviceRotation(deviceRotation)
            ? deviceRotation
            : DeviceRotation.Portrait;
          this.deviceSessionsManager.rotateAllDevices(deviceRotationResult);
        }
      )
    );

    this.disposables.push(this.stateManager, this.workspaceStateManager, this.devicesStateManager);
  }

  // #endregion Constructor

  // #region Device Session

  public onInitialized(): void {
    this.stateManager.setState({ initialized: true });
  }

  public onDeviceSessionsManagerStateChange(state: DeviceSessionsManagerState): void {
    this.updateProjectState(state);
  }

  public getDeviceRotation(): DeviceRotation {
    return this.workspaceStateManager.getState().deviceRotation;
  }

  private maybeStartInitialDeviceSession() {
    if (!Connector.getInstance().isEnabled && !this.deviceSessionsManager.selectedDeviceSession) {
      this.deviceSessionsManager.findInitialDeviceAndStartSession();
    }
  }

  public startOrActivateSessionForDevice(
    deviceInfo: DeviceInfo,
    selectDeviceOptions?: SelectDeviceOptions
  ): Promise<void> {
    return this.deviceSessionsManager.startOrActivateSessionForDevice(
      deviceInfo,
      selectDeviceOptions
    );
  }

  public terminateSession(deviceId: DeviceId): Promise<void> {
    return this.deviceSessionsManager.terminateSession(deviceId);
  }

  // #endregion Device Session

  // #region Tools Delegate

  public onToolsStateChange = (toolsState: ToolsState) => {
    this.eventEmitter.emit("toolsStateChanged", toolsState);
  };

  // #endregion Tools Delegate

  // #region Launch Configuration

  public async createOrUpdateLaunchConfiguration(
    newLaunchConfiguration: LaunchConfiguration | undefined,
    oldLaunchConfiguration?: LaunchConfiguration
  ) {
    const isUpdatingSelectedConfig = _.isEqual(
      oldLaunchConfiguration,
      this.selectedLaunchConfiguration
    );
    const newConfig = await this.launchConfigsManager.createOrUpdateLaunchConfiguration(
      newLaunchConfiguration,
      oldLaunchConfiguration
    );
    if (isUpdatingSelectedConfig && newConfig) {
      this.selectLaunchConfiguration(newConfig);
    }
  }

  public async selectLaunchConfiguration(launchConfig: LaunchConfiguration): Promise<void> {
    if (_.isEqual(launchConfig, this.selectedLaunchConfiguration)) {
      // No change in launch configuration, nothing to do
      return;
    }
    this.selectedLaunchConfiguration = launchConfig;
    await this.applicationContext.updateLaunchConfig(launchConfig);
    // NOTE: we reset the device sessions manager to close all the running sessions
    // and restart the current device with new config. In the future, we might want to keep the devices running
    // and only close the applications, but the API we have right now does not allow that.
    const oldDeviceSessionsManager = this.deviceSessionsManager;
    this.deviceSessionsManager = new DeviceSessionsManager(
      this.stateManager.getDerived("deviceSessions"),
      this.stateManager,
      this.applicationContext,
      this.deviceManager,
      this.devicesStateManager,
      this,
      this.outputChannelRegistry
    );
    oldDeviceSessionsManager.dispose();
    this.maybeStartInitialDeviceSession();

    this.launchConfigsManager.saveInitialLaunchConfig(launchConfig);
    this.updateProjectState({
      appRootPath: this.relativeAppRootPath,
      selectedLaunchConfiguration: launchConfig,
    });
  }

  // #endregion Launch Configuration

  // #region Dependency Checks

  public async runDependencyChecks(): Promise<void> {
    await Promise.all([
      this.applicationContext.applicationDependencyManager.runAllDependencyChecks(),
      this.environmentDependencyManager.runAllDependencyChecks(),
    ]);
  }

  // #endregion Dependency Checks

  // #region Device Settings

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

  // #endregion Device Settings

  // #region Tools

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    await this.deviceSession?.updateToolEnabledState(toolName, enabled);
  }

  public async openTool(toolName: ToolKey) {
    await this.deviceSession?.openTool(toolName);
  }

  // #endregion Tools

  // #region Radon Connect

  public async enableRadonConnect() {
    Connector.getInstance().enable();
  }

  public async disableRadonConnect() {
    Connector.getInstance().disable();
  }

  // #endregion Radon Connect

  // #region Debugger

  public async resumeDebugger() {
    this.deviceSession?.resumeDebugger();
  }

  public async stepOverDebugger() {
    this.deviceSession?.stepOverDebugger();
  }
  public async stepOutDebugger() {
    this.deviceSession?.stepOutDebugger();
  }
  public async stepIntoDebugger() {
    this.deviceSession?.stepIntoDebugger();
  }

  public async focusDebugConsole() {
    this.deviceSession?.resetLogCounter();
    commands.executeCommand("workbench.panel.repl.view.focus");
  }

  // #endregion Debugger

  // #region Routing and Navigation

  public async openNavigation(navigationItemID: string) {
    this.deviceSession?.openNavigation(navigationItemID);
  }

  public async navigateBack() {
    this.deviceSession?.navigateBack();
  }

  public async navigateHome() {
    getTelemetryReporter().sendTelemetryEvent("url-bar:go-home", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });

    if (this.applicationContext.applicationDependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    if (await this.applicationContext.applicationDependencyManager.checkProjectUsesExpoRouter()) {
      await this.deviceSession?.navigateHome();
    } else {
      await this.reloadMetro();
    }
  }

  private async reloadMetro() {
    try {
      await this.deviceSession?.performReloadAction("reloadJs");
      return true;
    } catch {
      return false;
    }
  }

  public async removeNavigationHistoryEntry(id: string): Promise<void> {
    this.deviceSession?.removeNavigationHistoryEntry(id);
  }

  // #endregion Routing and Navigation

  // #region Dev Menu

  public async openDevMenu() {
    await this.deviceSession?.openDevMenu();
  }

  // #endregion Dev Menu

  // #region License

  public async activateLicense(activationKey: string) {
    const computerName = os.hostname();
    const activated = await activateDevice(activationKey, computerName);
    return activated;
  }

  public async hasActiveLicense() {
    return !!(await getLicenseToken());
  }

  // #endregion License

  // #region Permissions

  public async resetAppPermissions(permissionType: AppPermissionType) {
    const needsRestart = await this.deviceSession?.resetAppPermissions(permissionType);
    if (needsRestart) {
      await this.deviceSessionsManager.reloadCurrentSession("restartProcess");
    }
  }

  // #endregion Permissions

  // #region DeepLinks

  public async getDeepLinksHistory() {
    return extensionContext.workspaceState.get<string[] | undefined>(DEEP_LINKS_HISTORY_KEY) ?? [];
  }

  public async openDeepLink(link: string, terminateApp: boolean) {
    const history = await this.getDeepLinksHistory();
    if (history.length === 0 || link !== history[0]) {
      extensionContext.workspaceState.update(
        DEEP_LINKS_HISTORY_KEY,
        [link, ...history.filter((s) => s !== link)].slice(0, DEEP_LINKS_HISTORY_LIMIT)
      );
    }

    this.deviceSession?.sendDeepLink(link, terminateApp);
  }

  // #endregion DeepLinks

  // #region File Transfer

  public async openSendFileDialog() {
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.openSendFileDialog();
  }

  public async sendFileToDevice({
    fileName,
    data,
  }: {
    fileName: string;
    data: ArrayBuffer;
  }): Promise<void> {
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.sendFileToDevice(fileName, data);
  }

  // #endregion

  // #region Recording

  public async toggleRecording() {
    getTelemetryReporter().sendTelemetryEvent("recording:toggle-recording", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.toggleRecording();
  }

  public async captureReplay() {
    getTelemetryReporter().sendTelemetryEvent("replay:capture-replay", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.captureReplay();
  }

  public async captureScreenshot() {
    getTelemetryReporter().sendTelemetryEvent("replay:capture-screenshot", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.captureScreenshot();
  }

  public async saveMultimedia(multimediaData: MultimediaData) {
    const defaultSavingPath = this.workspaceStateManager.getState().defaultMultimediaSavingLocation;
    return saveMultimedia(multimediaData, defaultSavingPath ?? undefined);
  }

  // note: this method is used by the radon AI functionality to capture screenshots of the application
  // thats why it is not part of the ProjectInterface
  public async getScreenshot() {
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    return this.deviceSession.getScreenshot();
  }

  // #endregion Recording

  // #region Frame Reporting

  public startReportingFrameRate() {
    getTelemetryReporter().sendTelemetryEvent("performance:start-frame-rate-reporting", {
      platform: this.selectedDeviceSessionState?.deviceInfo.platform,
    });
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.startReportingFrameRate();
  }

  public stopReportingFrameRate() {
    if (!this.deviceSession) {
      throw new Error("No device session available");
    }
    this.deviceSession.stopReportingFrameRate();
  }

  // #endregion Frame Reporting

  // #region Profiling

  async startProfilingCPU() {
    if (this.deviceSession) {
      await this.deviceSession.startProfilingCPU();
    } else {
      throw new Error("No application running");
    }
  }

  async stopProfilingCPU() {
    if (this.deviceSession) {
      await this.deviceSession.stopProfilingCPU();
    } else {
      throw new Error("No application running");
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

  // #endregion Profiling

  // #region Device Input

  public dispatchTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    this.deviceSession?.sendTouches(touches, type, this.getDeviceRotation());
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

  public async dispatchPaste(text: string) {
    await this.deviceSession?.sendClipboard(text);
    await this.editorBindings.showToast("Pasted to device clipboard", 2000);
  }

  public async dispatchCopy() {
    const text = await this.deviceSession?.getClipboard();
    if (text) {
      env.clipboard.writeText(text);
    }
    // For consistency between iOS and Android, we always display toast message
    await this.editorBindings.showToast("Copied from device clipboard", 2000);
  }

  // #endregion Device Input

  // #region Reloading

  public reloadCurrentSession(type: ReloadAction): Promise<void> {
    return this.deviceSessionsManager.reloadCurrentSession(type);
  }

  // #endregion Reloading

  // #region Inspector

  public async inspectElementAt(xRatio: number, yRatio: number, requestStack: boolean) {
    if (!this.deviceSession) {
      throw new Error("A device must be selected to inspect elements");
    }
    return this.deviceSession.inspectElementAt(xRatio, yRatio, requestStack);
  }

  // #endregion Inspector

  // #region Devices

  public createAndroidDevice(
    modelId: string,
    displayName: string,
    systemImage: AndroidSystemImageInfo
  ): Promise<DeviceInfo> {
    return this.deviceManager.createAndroidDevice(modelId, displayName, systemImage);
  }

  public createIOSDevice(
    deviceType: IOSDeviceTypeInfo,
    displayName: string,
    runtime: IOSRuntimeInfo
  ): Promise<DeviceInfo> {
    return this.deviceManager.createIOSDevice(deviceType, displayName, runtime);
  }

  public removeDevice(device: DeviceInfo): Promise<void> {
    return this.deviceManager.removeDevice(device);
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

  // #endregion Devices

  // #region Extension Interface

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
    if (this.applicationContext.applicationDependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    if (await this.applicationContext.applicationDependencyManager.checkProjectUsesStorybook()) {
      this.deviceSession?.openStorybookStory(componentTitle, storyName);
    } else {
      window.showErrorMessage("Storybook is not installed.", "Dismiss");
    }
  }

  public async sendBiometricAuthorization(isMatch: boolean) {
    await this.deviceSession?.sendBiometricAuthorization(isMatch);
  }

  // #endregion Extension Interface

  // #region Logging

  public async focusOutput(channel: Output): Promise<void> {
    this.outputChannelRegistry.getOrCreateOutputChannel(channel).show();
  }

  public async log(type: "info" | "error" | "warn" | "log", message: string, ...args: any[]) {
    Logger[type]("[WEBVIEW LOG]", message, ...args);
  }

  // #endregion Logging

  // #region Editor

  public getCommandsCurrentKeyBinding(commandName: string): Promise<string | undefined> {
    return this.editorBindings.getCommandsCurrentKeyBinding(commandName);
  }

  public movePanelTo(location: IDEPanelMoveTarget): Promise<void> {
    return this.editorBindings.movePanelTo(location);
  }

  public openExternalUrl(uriString: string): Promise<void> {
    return this.editorBindings.openExternalUrl(uriString);
  }

  public openFileAt(filePath: string, line0Based: number, column0Based: number): Promise<void> {
    return this.editorBindings.openFileAt(filePath, line0Based, column0Based);
  }

  public showDismissableError(errorMessage: string): Promise<void> {
    return this.editorBindings.showDismissableError(errorMessage);
  }

  public showToast(message: string, timeout: number): Promise<void> {
    return this.editorBindings.showToast(message, timeout);
  }

  // #endregion Editor

  // #region Telemetry

  public async reportIssue(): Promise<void> {
    this.telemetry.reportIssue();
  }

  public async sendTelemetry(
    eventName: string,
    properties?: TelemetryEventProperties
  ): Promise<void> {
    this.telemetry.sendTelemetry(eventName, properties);
  }

  // #endregion Telemetry

  // #region Event Emitter

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

  // #endregion Event Emitter

  // #region Dispose

  public dispose() {
    this.deviceSessionsManager.dispose();
    this.applicationContext.dispose();
    disposeAll(this.disposables);
  }

  // #endregion Dispose

  // #region To Be Removed

  // TODO: this should be removed from our public API
  // to control it's surface
  public async runCommand(command: string): Promise<void> {
    await commands.executeCommand(command);
  }

  // TODO: this should be moved to the new state management
  private updateProjectState(newState: Partial<ProjectState>) {
    const mergedState = { ...this.projectState, ...newState };
    this.projectState = mergedState;
    this.eventEmitter.emit("projectStateChanged", this.projectState);
  }

  // #endregion To Be Removed
}
