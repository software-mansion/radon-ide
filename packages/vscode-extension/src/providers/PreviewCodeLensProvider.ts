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
    const isStory = /.*stories.?(js|ts|jsx|tsx)$/.test(document.fileName);

    if (!text.includes("react-native-ide") && !isStory) {
      return [];
    }

    const codeLenses: CodeLens[] = [];

    if (isStory) {
      const componentName = this.extractComponentName(text);
      if (!componentName) {
        return [];
      }
      this.addStorybookCodeLenses(text, document, codeLenses, componentName);
    }
    this.addPreviewCodeLenses(text, document, codeLenses);
    return codeLenses;
  }

  extractComponentName(text: string): string | null {
    let componentName: string | null = null;
    const titlePropRegex = /title:\s*(['"`])(\w+)\1/;
    const titlePropMatch = titlePropRegex.exec(text);
    if (titlePropMatch) {
      componentName = titlePropMatch[2];
    } else {
      const componentRegex = /component:\s*(\w+)/;
      const componentMatch = componentRegex.exec(text);
      if (componentMatch) {
        componentName = componentMatch[1];
      }
    }
    return componentName;
  }

  addStorybookCodeLenses(
    text: string,
    document: TextDocument,
    codeLenses: CodeLens[],
    componentName: string
  ) {
    const storyRegex = /^(?:(?!\/\/).)*export const (\w+)(?::\s*\w+\s*)? =/gm;
    for (const match of text.matchAll(storyRegex)) {
      const storyName = match[1];
      const range = this.createRange(document, match.index);
      const command: Command = {
        title: "Select story",
        command: "RNIDE.showStorybookStory",
        arguments: [componentName, storyName],
      };
      codeLenses.push(new CodeLens(range, command));
    }
  }

  addPreviewCodeLenses(text: string, document: TextDocument, codeLenses: CodeLens[]) {
    const previewRegex = /^(?:(?!\/\/).)*\bpreview\b\s*\(/gm;
    for (const match of text.matchAll(previewRegex)) {
      const range = this.createRange(document, match.index);
      const command: Command = {
        title: "Open preview",
        command: "RNIDE.showPanel",
        arguments: [document.fileName, range.start.line + 1],
      };
      codeLenses.push(new CodeLens(range, command));
    }
  }
  createRange(document: TextDocument, matchIndex: number): Range {
    const position = document.positionAt(matchIndex);
    const line = document.lineAt(position.line);
    return new Range(line.lineNumber, 0, line.lineNumber, line.text.length);
  }
}
