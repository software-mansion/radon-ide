import {
  CodeLensProvider,
  TextDocument,
  CancellationToken,
  CodeLens,
  Range,
  Command,
} from "vscode";

export class MaestroCodeLensProvider implements CodeLensProvider {
  provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): CodeLens[] | Thenable<CodeLens[]> {

    if (!this.checkMaestroFile(document)) {
      return [];
    }
    
    const command: Command = {
      title: "Run Maestro test",
      command: "RNIDE.startMaestroTest",
      arguments: [
        document.fileName
      ],
    };
    
    const codeLenses: CodeLens[] = [];
    codeLenses.push(new CodeLens(this.createRange(document, 0), command));
    
    return codeLenses;
  }
  
  checkMaestroFile(document: TextDocument): boolean {
    // To fairly certainly identify a Maestro test file that we can run, it must:
    // not be named config.yaml or .yml
    // include "appId" (url on web, but we only do mobile)
    // include "---" splitting configuration and steps
    // include valid steps beginning with "-" that are not comments
    const text = document.getText();
    if (
      document.fileName.endsWith("config.yaml") || 
      document.fileName.endsWith("config.yml") ||
      !text.includes("appId:")
    ) {
        return false;
    }
    const splitText = text.split("---");
    const stepDashes = splitText[1]?.match(/^\s*-\s+/gm);
    if (splitText.length < 2 || !stepDashes) {
        return false;
    }
    return true;
  }

  createRange(document: TextDocument, matchIndex: number): Range {
    const position = document.positionAt(matchIndex);
    const line = document.lineAt(position.line);
    return new Range(line.lineNumber, 0, line.lineNumber, line.text.length);
  }
}
