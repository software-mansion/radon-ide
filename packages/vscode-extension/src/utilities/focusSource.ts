import { window, Position, ViewColumn, Selection, Uri } from "vscode";
import { DebugSource } from "../debugging/DebugSession";

/**
 * Opens and focuses the editor on the file specified in the given DebugSource object.
 * It positions the cursor at the specified line and column (if provided).
 * @param {DebugSource} source {@link DebugSource} containing file, line, and column details.
 */
export function focusSource(source: DebugSource) {
  if (!source.filename) {
    return;
  }
  const filePath = Uri.file(source.filename);
  window.showTextDocument(filePath, { viewColumn: ViewColumn.One }).then((editor) => {
    if (!source.line1based) {
      return;
    }
    const position = new Position(source.line1based - 1, 0);

    if (source.column0based) {
      position.translate(source.column0based);
    }

    editor.selections = [new Selection(position, position)];
  });
}
