import { window, workspace, ViewColumn, Range } from "vscode";
import { Logger } from "../Logger";

export async function openFileAtPosition(
  filePath: string,
  line0Based: number,
  column0Based: number
) {
  const existingDocument = workspace.textDocuments.find((document) => {
    Logger.debug(`Existing document list ${document.uri.fsPath}`);
    return document.uri.fsPath === filePath;
  });

  const selection = new Range(line0Based, column0Based, line0Based, column0Based);
  if (existingDocument) {
    // If the file is already open, show (focus on) its editor
    await window.showTextDocument(existingDocument, {
      selection,
      viewColumn: ViewColumn.One,
    });
  } else {
    // If the file is not open, open it in a new editor
    const document = await workspace.openTextDocument(filePath);
    await window.showTextDocument(document, {
      selection,
      viewColumn: ViewColumn.One,
    });
  }
}
