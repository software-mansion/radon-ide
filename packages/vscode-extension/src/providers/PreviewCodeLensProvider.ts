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
    const text = document.getText();
    const isStory = /.*stories.?(js|ts|jsx|tsx)/.test(document.fileName);

    // imported preview
    if (!text.includes("react-native-ide") && !isStory) {
      return [];
    }

    const codeLenses = [];
    // TODO refactor
    if (isStory) {
      const componentTitleRegex = /title:\s*(".*?"|'.*?'|`.*?`)/g;
      const componentTitleMatch = componentTitleRegex.exec(text);
      if (componentTitleMatch === undefined) {
        return [];
      }
      const componentTitle = componentTitleMatch![1].slice(1, -1);

      const storyRegex = /export const (\w+)(?::\s*\w+\s*)? =/g;
      for (const match of text.matchAll(storyRegex)) {
        const storyName = match[1];
        const line = document.lineAt(document.positionAt(match.index).line);
        const range = new Range(line.lineNumber, 0, line.lineNumber, line.text.length);
        const command: Command = {
          title: "Select story",
          command: "RNIDE.selectStorybookStory",
          arguments: [componentTitle, storyName],
        };
        codeLenses.push(new CodeLens(range, command));
      }
    } else {
      const regex = /\bpreview\b\s*\(/g;
      for (const match of text.matchAll(regex)) {
        const line = document.lineAt(document.positionAt(match.index).line);
        const range = new Range(line.lineNumber, 0, line.lineNumber, line.text.length);
        const command: Command = {
          title: "Open preview",
          command: "RNIDE.showPanel",
          arguments: [document.fileName, line.lineNumber + 1],
        };
        codeLenses.push(new CodeLens(range, command));
      }
    }

    return codeLenses;
  }
}
