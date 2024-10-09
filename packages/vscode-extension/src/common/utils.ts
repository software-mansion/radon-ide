import { RecordingData } from "./Project";

export interface UtilsInterface {
  getCommandsCurrentKeyBinding(commandName: string): Promise<string | undefined>;

  reportIssue(): Promise<void>;

  openFileAt(filePath: string, line0Based: number, column0Based: number): Promise<void>;

  saveVideoRecording(recordingData: RecordingData): Promise<boolean>;

  movePanelToNewWindow(): Promise<void>;

  showDismissableError(errorMessage: string): Promise<void>;

  openExternalUrl(uriString: string): Promise<void>;
}
