import { commands, languages, ExtensionContext } from "vscode";
import { PreviewsPanel } from "./panels/PreviewsPanel";
import { PreviewCodeLensProvider } from "./providers/PreviewCodeLensProvider";

export function activate(context: ExtensionContext) {
  const showPreviewsPanel = commands.registerCommand(
    "RNStudio.showPreviewsPanel",
    (fileName?: string, lineNumber?: number) => {
      PreviewsPanel.render(context, fileName, lineNumber);
    }
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { scheme: "file", language: "javascript" },
      new PreviewCodeLensProvider()
    )
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { scheme: "file", language: "typescript" },
      new PreviewCodeLensProvider()
    )
  );

  // Add command to the extension context
  context.subscriptions.push(showPreviewsPanel);

  if (process.env.RNSZ_DEV === "true") {
    commands.executeCommand("RNStudio.showPreviewsPanel", (e: any) => {
      console.log(e);
    });
  }
}
