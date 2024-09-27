export interface UtilsInterface {
  getCommandsCurrentKeyBinding(commandName: string): Promise<string | undefined>;

  reportIssue(): Promise<void>;

  openFileAt(filePath: string, line0Based: number, column0Based: number): Promise<void>;

  downloadFile(url: string, destinationPath?: string): Promise<void>;

  movePanelToNewWindow(): Promise<void>;

  showDismissableError(errorMessage: string): Promise<void>;

  openExternalUrl(uriString: string): Promise<void>;
}
