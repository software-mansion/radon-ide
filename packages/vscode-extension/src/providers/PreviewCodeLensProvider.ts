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

    // We detect whether a file is a storybook story based on filename.
    // If is ends with ".stories.js/ts/jsx/tsx", we treat it as a story file.
    const isStory = /\.stories\.(js|ts|jsx|tsx)$/.test(document.fileName);
    if (!text.includes("react-native-ide") && !text.includes("radon-ide") && !isStory) {
      // we use previous NPM package name for compatibility
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
    // Search for a "title" or a "component" field within the text to identify the component name.
    // If no "title" field is present, then search for the "component" field,
    // which is mandatory in the Component Story Format (CSF).
    let componentName: string | null = null;
    // Detected example: title: "#ComponentTitle#".
    const titlePropRegex = /title:\s*(['"`])(\w+)\1/;
    const titlePropMatch = titlePropRegex.exec(text);
    if (titlePropMatch) {
      componentName = titlePropMatch[2];
    } else {
      // Detected example: component: #ComponentName#.
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
    // Detect stories defined in the Component Story Format (CSF).
    // Each named export within the file corresponds to a story object. CodeLens annotations are applied to these lines.
    // The pattern captures stories with whitespace between 'export' and identifiers like 'const', 'let', or 'var',
    // and it excludes lines commented out with double slashes preceding the export.
    // Detected example: export const Basic: Story =
    const storyRegex = /^(?:(?!\/\/) )*export\s+(const|let|var)\s+(\w+)(?::\s*\w+\s*)? =/gm;
    for (const match of text.matchAll(storyRegex)) {
      const storyName = match[2];
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
    // Detect usage of the preview function followed by an opening parenthesis
    // which are not preceded by double slashes indicating a comment. Detected example: preview(
    const previewRegex = /^(?:(?!\/\/) )*\bpreview\b\s*\(/gm;
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
