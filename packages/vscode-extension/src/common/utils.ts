import { TelemetryEventProperties } from "@vscode/extension-telemetry";
import { RecordingData } from "./Project";

export interface UtilsEventListener<T> {
  (event: T): void;
}

export interface UtilsEventMap {
  telemetryEnabledChanged: boolean;
}

export interface UtilsInterface {
  getCommandsCurrentKeyBinding(commandName: string): Promise<string | undefined>;

  reportIssue(): Promise<void>;

  openFileAt(filePath: string, line0Based: number, column0Based: number): Promise<void>;

  saveVideoRecording(recordingData: RecordingData): Promise<boolean>;

  movePanelToNewWindow(): Promise<void>;

  showDismissableError(errorMessage: string): Promise<void>;

  openExternalUrl(uriString: string): Promise<void>;

  log(type: "info" | "error" | "warn" | "log", message: string, ...args: any[]): Promise<void>;

  sendTelemetry(eventName: string, properties?: TelemetryEventProperties): Promise<void>;

  isTelemetryEnabled(): Promise<boolean>;

  addListener<K extends keyof UtilsEventMap>(
    eventType: K,
    listener: UtilsEventListener<UtilsEventMap[K]>
  ): Promise<void>;

  removeListener<K extends keyof UtilsEventMap>(
    eventType: K,
    listener: UtilsEventListener<UtilsEventMap[K]>
  ): Promise<void>;
}
