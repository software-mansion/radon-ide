import { isEqual } from "lodash";
import { DebugSessionCustomEvent, Disposable, env, window, workspace } from "vscode";
import { EventEmitter } from "stream";
import { DeviceInfo } from "../common/DeviceManager";
import { DeviceAlreadyUsedError, DeviceManager } from "../devices/DeviceManager";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { ApplicationContext } from "./ApplicationContext";
import { AppEvent, DeviceSession, DeviceState } from "./deviceSession";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { CancelError } from "../builders/cancelToken";
import {
  DeviceSessionsManagerInterface,
  ReloadAction,
  SelectDeviceOptions,
  DeviceSessionManagerEventMap,
  DeviceSessionManagerEventListener,
  DeviceId,
  DeviceSessionsManagerDelegate,
  DeviceSettings,
  ToolsState,
  AppPermissionType,
  TouchPoint,
  InspectData,
} from "../common/DeviceSessionsManager";
import { disposeAll } from "../utilities/disposables";
import { maybeHandleProfileFile } from "../utilities/profiles";
import { getTelemetryReporter } from "../utilities/telemetry";
import { UtilsInterface } from "../common/utils";
import { ToolKey } from "./tools";
import { minimatch } from "minimatch";
import { DeviceButtonType } from "../common/Project";
import { isAppSourceFile } from "../utilities/isAppSourceFile";

const LAST_SELECTED_DEVICE_KEY = "last_selected_device";

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
  private deviceSessions: Map<string, DeviceSession> = new Map();

  private eventEmitter = new EventEmitter();

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

  constructor(
    private readonly applicationContext: ApplicationContext,
    private readonly deviceManager: DeviceManager,
    private readonly utils: UtilsInterface,
    private delegate: DeviceSessionsManagerDelegate
  ) {
    this.trySelectingDevice();
    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);
  }

  private getDeviceSessionById(deviceId: DeviceId) {
    const deviceSession = this.deviceSessions.get(deviceId);

    if (!deviceSession) {
      throw new Error("Requested device is not available");
    }

    return deviceSession;
  }

  private async trySelectingActiveDeviceSession(id: string, killPreviousDeviceSession?: boolean) {
    if (!this.deviceSessions.has(id)) {
      return false;
    }
    if (this.selectedDevice) {
      if (killPreviousDeviceSession) {
        this.killAndRemoveDevice(this.selectedDevice);
      } else {
        await this.selectedDeviceSession?.deactivate();
      }
    }
    this.selectedDevice = id;
    this.selectedDeviceSession?.activate();
    return true;
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

  public async stopDevice(deviceId: string) {
    if (deviceId === this.selectedDevice) {
      window.showWarningMessage(
        "You cannot stop the selected device. Please select another device first.",
        "Dismiss"
      );
      return false;
    }
    const deviceSession = this.deviceSessions.get(deviceId);
    if (!deviceSession) {
      Logger.warn("Failed to stop device, device wasn't running.", "Dismiss");
      return true;
    }
    await this.killAndRemoveDevice(deviceId);
    return true;
  }

  public async startDevice(deviceInfo: DeviceInfo) {
    if (this.deviceSessions.has(deviceInfo.id)) {
      Logger.warn("[DeviceSessionManager] Device is already running.");
      return false;
    }

    const device = await this.selectDeviceOnly(deviceInfo);
    if (!device) {
      return false;
    }

    const newDeviceSession = new DeviceSession(
      this.applicationContext.appRootFolder,
      device,
      this.applicationContext.dependencyManager,
      this.applicationContext.buildCache,
      wrapDelegateWithDeviceId(this as DeviceSessionsManager, deviceInfo.id)
    );
    this.deviceSessions.set(deviceInfo.id, newDeviceSession);

    await newDeviceSession.start({
      resetMetroCache: false,
      cleanBuild: false,
    });
    return true;
  }

  public async selectDevice(deviceInfo: DeviceInfo, selectDeviceOptions?: SelectDeviceOptions) {
    if (!this.deviceSessions.has(deviceInfo.id)) {
      Logger.error("[DeviceSessionManager] Device was not started yet.");
      return false;
    }

    const killPreviousDeviceSession = !selectDeviceOptions?.preservePreviousDevice;

    const selectedActiveSession = await this.trySelectingActiveDeviceSession(
      deviceInfo.id,
      killPreviousDeviceSession
    );

    if (selectedActiveSession) {
      // Frytki
      // this.onDeviceSelected(
      //   deviceInfo,
      //   this.selectedDeviceSession?.previewURL
      // );
      return true;
    }

    const device = await this.selectDeviceOnly(deviceInfo);
    if (!device) {
      return false;
    }
    Logger.debug("Selected device is ready");

    if (this.selectedDevice) {
      if (killPreviousDeviceSession) {
        await this.killAndRemoveDevice(this.selectedDevice);
      } else {
        await this.selectedDeviceSession?.deactivate();
      }
    }
    // frytki
    return true;
  }

  /**
   * This method tries to select any running device, if there isn't any
   * it tries to select the last selected device from devices list.
   * If the device list is empty, we wait until we can select a device.
   */
  private async trySelectingDevice() {
    const anyActiveDeviceSessionId = this.deviceSessions.keys().next().value;

    if (anyActiveDeviceSessionId) {
      const selectedActiveSession = await this.trySelectingActiveDeviceSession(
        anyActiveDeviceSessionId,
        true
      );
      if (selectedActiveSession) {
        return true;
      }
    }

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
        if (this.selectedDevice) {
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

  // used in callbacks, needs to be an arrow function
  private removeDeviceListener = async (device: DeviceInfo) => {
    await this.killAndRemoveDevice(device.id);
    if (this.selectedDevice === device.id) {
      await this.trySelectingDevice();
    }
  };

  private async killAndRemoveDevice(deviceId: string) {
    const deviceSession = this.deviceSessions.get(deviceId);
    await deviceSession?.dispose();
    this.deviceSessions.delete(deviceId);
  }

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

  public dispatchTouches(deviceId: DeviceId, touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
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

  startRecording(deviceId: DeviceId): void {
    const deviceSession = this.getDeviceSessionById(deviceId);

    getTelemetryReporter().sendTelemetryEvent("recording:start-recording", {
      platform: deviceSession.platform,
    });
    deviceSession.startRecording();
    this.eventEmitter.emit("isRecording", true);

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

    this.eventEmitter.emit("isRecording", false);
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

  public async openComponentPreview(deviceId: DeviceId, fileName: string, lineNumber1Based: number) {
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

  //#region Device Session Delegate
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

  //#endregion

  dispose() {
    disposeAll(this.deviceSessions.values().toArray());
    this.deviceManager.removeListener("deviceRemoved", this.removeDeviceListener);
  }
}
