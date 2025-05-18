import { DebugSessionCustomEvent, Disposable, env, window, workspace } from "vscode";
import { EventEmitter } from "stream";
import { DeviceId, DeviceInfo } from "../common/DeviceManager";
import { DeviceAlreadyUsedError, DeviceManager } from "../devices/DeviceManager";
import { Logger } from "../Logger";
import { ApplicationContext } from "./ApplicationContext";
import { DeviceSession } from "./deviceSession";
import { CancelError } from "../builders/cancelToken";
import {
  DeviceSessionsManagerInterface,
  ReloadAction,
  DeviceSessionManagerEventMap,
  DeviceSessionManagerEventListener,
  DeviceSessionsManagerDelegate,
  DeviceSettings,
  ToolsState,
  AppPermissionType,
  TouchPoint,
  InspectData,
  DeviceButtonType,
} from "../common/DeviceSessionsManager";
import { disposeAll } from "../utilities/disposables";
import { maybeHandleProfileFile } from "../utilities/profiles";
import { getTelemetryReporter } from "../utilities/telemetry";
import { UtilsInterface } from "../common/utils";
import { ToolKey } from "./tools";
import { minimatch } from "minimatch";
import { isAppSourceFile } from "../utilities/isAppSourceFile";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { AppEvent, DeviceState } from "../common/DeviceSession";

const MAX_RECORDING_TIME_SEC = 10 * 60; // 10 minutes

type DelegateWithId<T> = {
  [K in keyof T]: T[K] extends (id: DeviceId, ...args: infer A) => infer R
    ? (...args: A) => R
    : T[K];
};

function wrapDelegateWithDeviceId<T extends Object>(delegate: T, id: string): DelegateWithId<T> {
  return new Proxy(delegate, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);

      if (typeof original === "function") {
        return (...args: any[]) => original.call(target, id, ...args);
      }

      return original;
    },
  }) as any;
}

export class DeviceSessionsManager implements DeviceSessionsManagerInterface, Disposable {
  private deviceSessions: Map<DeviceId, DeviceSession> = new Map();
  private eventEmitter = new EventEmitter();

  constructor(
    private readonly applicationContext: ApplicationContext,
    private readonly deviceManager: DeviceManager,
    private readonly utils: UtilsInterface,
    private delegate: DeviceSessionsManagerDelegate
  ) {}

  private getDeviceSessionById(deviceId: DeviceId) {
    const deviceSession = this.deviceSessions.get(deviceId);

    if (!deviceSession) {
      throw new Error("Requested device is not available");
    }

    return deviceSession;
  }

  // #region Device Session Control

  public async getDeviceState(id: DeviceId) {
    const deviceSession = this.getDeviceSessionById(id);

    return deviceSession.getDeviceState();
  }

  public async reload(id: DeviceId, type: ReloadAction) {
    const deviceSession = this.deviceSessions.get(id);
    if (!deviceSession) {
      window.showErrorMessage("Failed to reload, device not found.", "Dismiss");
      return false;
    }

    try {
      const success = await deviceSession.perform(type);
      if (success) {
        return true;
      } else if (!success) {
        window.showErrorMessage("Failed to reload, you may try another reload option.", "Dismiss");
      }
    } catch (e) {
      if (e instanceof CancelError) {
        return false;
      }
      Logger.error("Failed to reload device", e);
      throw e;
    }
    return false;
  }

  public async stopDevice(deviceId: DeviceId) {
    const deviceSession = this.deviceSessions.get(deviceId);

    if (!deviceSession) {
      Logger.warn("Failed to stop device, device wasn't running.");
      return true;
    }

    if (!deviceSession.getDeviceState().isActive) {
      Logger.error("Failed to stop device, device is active.");
      return false;
    }

    await this.killAndRemoveDevice(deviceId);
    return true;
  }

  public async initializeDevice(deviceInfo: DeviceInfo) {
    if (this.deviceSessions.has(deviceInfo.id)) {
      Logger.warn("[DeviceSessionManager] Device is already running.");
      return false;
    }

    const device = await this.acquireDevice(deviceInfo);
    if (!device) {
      return false;
    }

    const newDeviceSession = new DeviceSession(
      this.applicationContext.appRootFolder,
      this.deviceManager,
      device,
      this.applicationContext.dependencyManager,
      this.applicationContext.buildCache,
      wrapDelegateWithDeviceId(this as DeviceSessionsManager, deviceInfo.id)
    );
    this.deviceSessions.set(deviceInfo.id, newDeviceSession);
    this.eventEmitter.emit("runningDevicesChanged", await this.listRunningDevices());

    newDeviceSession.start({
      resetMetroCache: false,
      cleanBuild: false,
    });
    return true;
  }

  public async listRunningDevices() {
    return this.deviceSessions.keys().toArray();
  }

  public async activateDevice(id: DeviceId): Promise<void> {
    const deviceSession = this.getDeviceSessionById(id);

    await deviceSession.activate();
  }

  public async deactivateDevice(id: DeviceId): Promise<void> {
    const deviceSession = this.getDeviceSessionById(id);

    await deviceSession.deactivate();
  }

  private async acquireDevice(deviceInfo: DeviceInfo) {
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
      Logger.debug("Device acquired", deviceInfo.displayName);
      return device;
    }
    return undefined;
  }

  private async killAndRemoveDevice(deviceId: DeviceId) {
    const deviceSession = this.deviceSessions.get(deviceId);
    await deviceSession?.dispose();
    this.deviceSessions.delete(deviceId);
    this.eventEmitter.emit("runningDevicesChanged", await this.listRunningDevices());
  }

  // #endregion

  // #region Device Control

  async openDeepLink(deviceId: DeviceId, link: string, terminateApp: boolean) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    this.delegate.onOpenDeepLink(link);

    deviceSession.sendDeepLink(link, terminateApp);
  }

  private async reloadMetro(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    if (await deviceSession.perform("reloadJs")) {
      return true;
    }
    return false;
  }

  public async goHome(deviceId: DeviceId, homeUrl: string) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    getTelemetryReporter().sendTelemetryEvent("url-bar:go-home", {
      platform: deviceSession.platform,
    });

    if (this.applicationContext.dependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    if (await this.applicationContext.dependencyManager.checkProjectUsesExpoRouter()) {
      await this.openNavigation(deviceId, homeUrl);
    } else {
      await this.reloadMetro(deviceId);
    }
  }

  public async getDeviceSettings(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    return deviceSession.deviceSettings;
  }

  public async updateDeviceSettings(deviceId: DeviceId, settings: DeviceSettings) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    let needsRestart = await deviceSession.changeDeviceSettings(settings);

    if (needsRestart) {
      await deviceSession.perform("reboot");
    }
  }

  async resetAppPermissions(deviceId: DeviceId, permissionType: AppPermissionType) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    const needsRestart = await deviceSession.resetAppPermissions(permissionType);
    if (needsRestart) {
      deviceSession.perform("restartProcess");
    }
  }

  // #endregion

  // #region User input for device

  public async sendBiometricAuthorization(deviceId: DeviceId, isMatch: boolean) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    await deviceSession?.sendBiometricAuthorization(isMatch);
  }

  public dispatchTouches(
    deviceId: DeviceId,
    touches: Array<TouchPoint>,
    type: "Up" | "Move" | "Down"
  ) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.sendTouches(touches, type);
  }

  public dispatchKeyPress(deviceId: DeviceId, keyCode: number, direction: "Up" | "Down") {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.sendKey(keyCode, direction);
  }

  public dispatchButton(deviceId: DeviceId, button: DeviceButtonType, direction: "Up" | "Down") {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.sendButton(button, direction);
  }

  public dispatchWheel(deviceId: DeviceId, point: TouchPoint, deltaX: number, deltaY: number) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.sendWheel(point, deltaX, deltaY);
  }

  public async inspectElementAt(
    deviceId: DeviceId,
    xRatio: number,
    yRatio: number,
    requestStack: boolean,
    callback: (inspectData: InspectData) => void
  ) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.inspectElementAt(xRatio, yRatio, requestStack, (inspectData) => {
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

  // #endregion

  // #region Recording

  private recordingTimeout: NodeJS.Timeout | undefined = undefined;

  public async isRecording(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    return deviceSession.getDeviceState().isRecording;
  }

  startRecording(deviceId: DeviceId): void {
    const deviceSession = this.getDeviceSessionById(deviceId);

    getTelemetryReporter().sendTelemetryEvent("recording:start-recording", {
      platform: deviceSession.platform,
    });
    deviceSession.startRecording();
    this.eventEmitter.emit("isRecording", { deviceId, isRecording: true });

    this.recordingTimeout = setTimeout(() => {
      this.stopRecording(deviceId);
    }, MAX_RECORDING_TIME_SEC * 1000);
  }

  private async stopRecording(deviceId: DeviceId) {
    clearTimeout(this.recordingTimeout);

    const deviceSession = this.getDeviceSessionById(deviceId);

    getTelemetryReporter().sendTelemetryEvent("recording:stop-recording", {
      platform: deviceSession.platform,
    });

    this.eventEmitter.emit("isRecording", { deviceId, isRecording: false });
    return deviceSession.captureAndStopRecording();
  }

  async captureAndStopRecording(deviceId: DeviceId) {
    const recording = await this.stopRecording(deviceId);
    await this.utils.saveMultimedia(recording);
  }

  async toggleRecording(deviceId: DeviceId) {
    if (this.recordingTimeout) {
      this.captureAndStopRecording(deviceId);
    } else {
      this.startRecording(deviceId);
    }
  }

  async captureReplay(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    getTelemetryReporter().sendTelemetryEvent("replay:capture-replay", {
      platform: deviceSession.platform,
    });

    const replay = await deviceSession.captureReplay();
    this.eventEmitter.emit("replayDataCreated", replay);
  }

  async captureScreenshot(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    getTelemetryReporter().sendTelemetryEvent("replay:capture-screenshot", {
      platform: deviceSession.platform,
    });

    const screenshot = await deviceSession.captureScreenshot();
    await this.utils.saveMultimedia(screenshot);
  }

  // #endregion

  // #region Tools

  public async getToolsState(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    return deviceSession.toolsManager.getToolsState() ?? {};
  }

  public async updateToolEnabledState(deviceId: DeviceId, toolName: ToolKey, enabled: boolean) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    await deviceSession.toolsManager.updateToolEnabledState(toolName, enabled);
  }

  public async openTool(deviceId: DeviceId, toolName: ToolKey) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    await deviceSession.toolsManager.openTool(toolName);
  }

  public getToolPlugin(deviceId: DeviceId, toolName: ToolKey) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    return deviceSession.toolsManager.getPlugin(toolName);
  }

  public async openDevMenu(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    await deviceSession.openDevMenu();
  }

  // #endregion

  // #region Debugger control

  public async resumeDebugger(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.resumeDebugger();
  }

  public async stepOverDebugger(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.stepOverDebugger();
  }

  // #endregion

  public async focusBuildOutput(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.focusBuildOutput();
  }

  // #region Profiling

  async isProfilingCPU(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    return deviceSession.getDeviceState().isProfilingCPU;
  }

  async startProfilingCPU(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    await deviceSession.startProfilingCPU();
  }

  async stopProfilingCPU(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    await deviceSession.stopProfilingCPU();
  }

  // #endregion

  // #region Clipboard control

  async dispatchPaste(deviceId: DeviceId, text: string) {
    const deviceSession = this.getDeviceSessionById(deviceId);
    await deviceSession.sendClipboard(text);
    await this.utils.showToast("Pasted to device clipboard", 2000);
  }

  async dispatchCopy(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    const text = await deviceSession?.getClipboard();
    if (text) {
      env.clipboard.writeText(text);
    }
    // For consistency between iOS and Android, we always display toast message
    await this.utils.showToast("Copied from device clipboard", 2000);
  }

  // #endregion

  // #region Application Navigation

  public async openNavigation(deviceId: DeviceId, navigationItemID: string) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    deviceSession.openNavigation(navigationItemID);
  }

  public async openComponentPreview(
    deviceId: DeviceId,
    fileName: string,
    lineNumber1Based: number
  ) {
    const deviceSession = this.getDeviceSessionById(deviceId);
    try {
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

  public async showStorybookStory(deviceId: DeviceId, componentTitle: string, storyName: string) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    if (this.applicationContext.dependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    if (await this.applicationContext.dependencyManager.checkProjectUsesStorybook()) {
      deviceSession.devtools.send("RNIDE_showStorybookStory", { componentTitle, storyName });
    } else {
      window.showErrorMessage("Storybook is not installed.", "Dismiss");
    }
  }

  // #endregion

  // #region Device Session Delegate
  public onNavigationChanged(deviceId: DeviceId, payload: AppEvent["navigationChanged"]) {
    this.eventEmitter.emit("navigationChanged", { ...payload, deviceId });
  }

  public onCacheStale(deviceId: DeviceId): void {
    this.eventEmitter.emit("needsNativeRebuild", { deviceId });
  }

  public onDeviceStateChanged(deviceId: DeviceId, deviceState: DeviceState) {
    this.eventEmitter.emit("deviceStateChanged", { deviceId, deviceState });
  }

  public onDeviceSettingChanged(id: DeviceId, deviceSettings: DeviceSettings) {
    this.eventEmitter.emit("deviceSettingsChanged", { deviceId: id, deviceSettings });
  }

  public async ensureDependenciesAndNodeVersion(_deviceId: DeviceId) {
    await this.delegate.ensureDependenciesAndNodeVersion();
  }

  public onToolsStateChange = (deviceId: DeviceId, toolsState: ToolsState) => {
    this.eventEmitter.emit("", { deviceId, toolsState });
  };

  public onConsoleLog(deviceId: DeviceId, event: DebugSessionCustomEvent) {
    this.eventEmitter.emit("log", { deviceId, payload: event.body });
  }

  onProfilingCPUStarted(deviceId: DeviceId, _event: DebugSessionCustomEvent): void {
    this.eventEmitter.emit("isProfilingCPU", { deviceId, isProfiling: true });
  }

  async onProfilingCPUStopped(deviceId: DeviceId, event: DebugSessionCustomEvent) {
    this.eventEmitter.emit("isProfilingCPU", { deviceId, isProfiling: false });

    // Handle the profile file if a file path is provided
    await maybeHandleProfileFile(event);
  }

  // #endregion

  // #region metro

  getMetroPort(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    return deviceSession.metro.port;
  }

  // #endregion

  // #region devtools

  getDevtools(deviceId: DeviceId) {
    const deviceSession = this.getDeviceSessionById(deviceId);

    return deviceSession.devtools;
  }

  // #endregion

  // #region EventEmitter implementation

  async addListener<K extends keyof DeviceSessionManagerEventMap>(
    eventType: K,
    listener: DeviceSessionManagerEventListener<DeviceSessionManagerEventMap[K]>
  ) {
    this.eventEmitter.addListener(eventType, listener);
  }

  async removeListener<K extends keyof DeviceSessionManagerEventMap>(
    eventType: K,
    listener: DeviceSessionManagerEventListener<DeviceSessionManagerEventMap[K]>
  ) {
    this.eventEmitter.removeListener(eventType, listener);
  }

  // #endregion

  // #region disposable implementation

  dispose() {
    disposeAll(this.deviceSessions.values().toArray());
  }

  // #endregion
}
