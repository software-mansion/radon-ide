import {
  CodeLensProvider,
  TextDocument,
  CancellationToken,
  CodeLens,
  Range,
  Command,
} from "vscode";

export class PreviewCodeLensProvider implements CodeLensProvider {
  provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): CodeLens[] | Thenable<CodeLens[]> {
    const regex = /\bpreview\b\s*\(/g;
    let matches;
    const codeLenses = [];

    while ((matches = regex.exec(document.getText()))) {
      const line = document.lineAt(document.positionAt(matches.index).line);
      const range = new Range(line.lineNumber, 0, line.lineNumber, line.text.length);
      const command: Command = {
        title: "Open preview",
        command: "RNStudio.showPreviewsPanel",
        arguments: [document.fileName, line.lineNumber + 1],
      };
      codeLenses.push(new CodeLens(range, command));
    }

    return codeLenses;
  }
}
