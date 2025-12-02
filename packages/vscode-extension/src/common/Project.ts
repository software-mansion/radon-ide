import { TelemetryEventProperties } from "@vscode/extension-telemetry";
import { ReloadAction } from "../project/DeviceSessionsManager";
import { LaunchConfiguration } from "./LaunchConfig";
import { Output } from "./OutputChannel";
import {
  AndroidSystemImageInfo,
  DeviceInfo,
  DeviceRotation,
  IOSDeviceTypeInfo,
  IOSRuntimeInfo,
  MultimediaData,
  ToolsState,
} from "./State";
import { Sentiment } from "./types";

export type DeviceId = DeviceInfo["id"];

export type ConnectState = {
  enabled: boolean;
  connected: boolean;
};

export type ProjectState = {
  appRootPath: string | undefined;
  selectedLaunchConfiguration: LaunchConfiguration;
  customLaunchConfigurations: LaunchConfiguration[];
  connectState: ConnectState;
};

export type AppPermissionType = "all" | "location" | "photos" | "contacts" | "calendar";

export type DeviceButtonType = "home" | "back" | "appSwitch" | "volumeUp" | "volumeDown" | "power";

export enum DeviceRotationDirection {
  Clockwise = -1,
  Anticlockwise = 1,
}

export const ROTATIONS: DeviceRotation[] = [
  DeviceRotation.LandscapeLeft,
  DeviceRotation.Portrait,
  DeviceRotation.LandscapeRight,
  DeviceRotation.PortraitUpsideDown,
] as const;

export type AppOrientation = DeviceRotation | "Landscape";

export type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SourceInfo = {
  fileName: string;
  line0Based: number;
  column0Based: number;
};

export type InspectDataStackItem = {
  componentName: string;
  hide: boolean;
  source: SourceInfo;
  frame: Frame;
};

export type InspectStackData = {
  requestLocation: { x: number; y: number };
  stack: InspectDataStackItem[];
};

export type InspectData = {
  stack: InspectDataStackItem[] | undefined;
  frame?: Frame;
};

export type TouchPoint = {
  xRatio: number;
  yRatio: number;
};

export enum ActivateDeviceResult {
  succeeded,
  notEnoughSeats,
  keyVerificationFailed,
  unableToVerify,
  connectionFailed,
}

export interface ProjectEventMap {
  projectStateChanged: ProjectState;
  licenseActivationChanged: boolean;
}

export interface ProjectEventListener<T> {
  (event: T): void;
}

export type IDEPanelMoveTarget = "new-window" | "editor-tab" | "side-panel";

export interface ProjectInterface {
  getProjectState(): Promise<ProjectState>;

  /**
   * Creates a new launch configuration or updates an existing one.
   *
   * If the `oldLaunchConfiguration` matches the currently selected launch configuration,
   * the newly created or updated configuration will be selected.
   *
   * @param newLaunchConfiguration - The options for the new or updated launch configuration. If `undefined`, the existing configuration will be removed.
   * @param oldLaunchConfiguration - (Optional) The existing launch configuration to update.
   * @returns A promise that resolves when the operation is complete.
   */
  createOrUpdateLaunchConfiguration(
    newLaunchConfiguration: LaunchConfiguration | undefined,
    oldLaunchConfiguration?: LaunchConfiguration
  ): Promise<void>;
  selectLaunchConfiguration(launchConfig: LaunchConfiguration): Promise<void>;

  runDependencyChecks(): Promise<void>;

  rotateDevices(direction: DeviceRotationDirection): Promise<void>;
  toggleDeviceAppearance(): Promise<void>;

  updateToolEnabledState(toolName: keyof ToolsState, enabled: boolean): Promise<void>;
  openTool(toolName: keyof ToolsState): Promise<void>;

  enableRadonConnect(): Promise<void>;
  disableRadonConnect(): Promise<void>;

  resumeDebugger(): Promise<void>;
  stepOverDebugger(): Promise<void>;
  stepIntoDebugger(): Promise<void>;
  stepOutDebugger(): Promise<void>;
  focusDebugConsole(): Promise<void>;

  openNavigation(navigationItemID: string): Promise<void>;
  navigateBack(): Promise<void>;
  navigateHome(): Promise<void>;
  removeNavigationHistoryEntry(id: string): Promise<void>;

  openDevMenu(): Promise<void>;

  activateLicense(activationKey: string): Promise<ActivateDeviceResult>;

  resetAppPermissions(permissionType: AppPermissionType): Promise<void>;

  getDeepLinksHistory(): Promise<string[]>;
  openDeepLink(link: string, terminateApp: boolean): Promise<void>;

  openSendFileDialog(): Promise<void>;
  sendFileToDevice(fileDescription: { fileName: string; data: ArrayBuffer }): Promise<void>;

  toggleRecording(): void;
  captureReplay(): void;
  captureScreenshot(): void;
  saveMultimedia(multimediaData: MultimediaData): Promise<boolean>;

  startReportingFrameRate(): void;
  stopReportingFrameRate(): void;

  startProfilingCPU(): void;
  stopProfilingCPU(): void;
  startProfilingReact(): void;
  stopProfilingReact(): void;

  openSelectMaestroFileDialog(): Promise<string[] | undefined>;
  startMaestroTest(fileNames: string[]): Promise<void>;
  stopMaestroTest(): Promise<void>;

  dispatchTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down"): void;
  dispatchKeyPress(keyCode: number, direction: "Up" | "Down"): void;
  dispatchButton(buttonType: DeviceButtonType, direction: "Up" | "Down"): void;
  dispatchWheel(point: TouchPoint, deltaX: number, deltaY: number): void;
  dispatchPaste(text: string): Promise<void>;
  dispatchCopy(): Promise<void>;
  dispatchHomeButtonPress(): void;
  dispatchAppSwitchButtonPress(): void;

  sendBiometricAuthorization(isMatch: boolean): Promise<void>;

  reloadCurrentSession(type: ReloadAction): Promise<void>;
  startOrActivateSessionForDevice(deviceInfo: DeviceInfo): Promise<void>;
  terminateSession(deviceId: DeviceId): Promise<void>;

  inspectElementAt(xRatio: number, yRatio: number, requestStack: boolean): Promise<InspectData>;

  createAndroidDevice(
    modelId: string,
    displayName: string,
    systemImage: AndroidSystemImageInfo
  ): Promise<DeviceInfo>;
  createIOSDevice(
    deviceType: IOSDeviceTypeInfo,
    displayName: string,
    runtime: IOSRuntimeInfo
  ): Promise<DeviceInfo>;
  loadInstalledImages(): void;
  renameDevice(device: DeviceInfo, newDisplayName: string): Promise<void>;
  removeDevice(device: DeviceInfo): Promise<void>;

  log(type: "info" | "error" | "warn" | "log", message: string, ...args: any[]): Promise<void>;
  focusOutput(channel: Output): Promise<void>;

  buildDiagnosticsReport(logFilesToInclude: string[]): Promise<void>;
  getLogFileNames(): Promise<string[]>;
  getCommandsCurrentKeyBinding(commandName: string): Promise<string | undefined>;
  movePanelTo(location: IDEPanelMoveTarget): Promise<void>;
  openExternalUrl(uriString: string): Promise<void>;
  openFileAt(filePath: string, line0Based: number, column0Based: number): Promise<void>;
  showDismissableError(errorMessage: string): Promise<void>;
  showToast(message: string, timeout: number): Promise<void>;
  openLaunchConfigurationFile(): Promise<void>;

  reportIssue(): Promise<void>;
  sendFeedback(
    sentiment: Sentiment,
    options: {
      message?: string;
      includeLogs?: boolean;
    }
  ): Promise<void>;
  sendTelemetry(eventName: string, properties?: TelemetryEventProperties): Promise<void>;

  addListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ): Promise<void>;
}
