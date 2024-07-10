export interface UtilsEventMap {
  // log: { type: string };
  // projectStateChanged: ProjectState;
  // deviceSettingsChanged: DeviceSettings;
  // navigationChanged: { displayName: string; id: string };
  // needsNativeRebuild: void;
}

export interface UtilsEventListener<T> {
  (event: T): void;
}

export interface UtilsInterface {
  getCommandsCurrentKeyBinding(commandName: string): Promise<string | undefined>;

  reportIssue(): Promise<void>;

  openFileAt(filePath: string, line0Based: number, column0Based: number): Promise<void>;
  movePanelToNewWindow(): void;
}
