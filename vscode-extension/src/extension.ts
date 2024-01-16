import {
  commands,
  languages,
  debug,
  ExtensionContext,
  DebugConfigurationProviderTriggerKind,
} from "vscode";
import { PreviewsPanel } from "./panels/PreviewsPanel";
import { Project } from "./project/project";
import { PreviewCodeLensProvider } from "./providers/PreviewCodeLensProvider";
import { DebugConfigProvider } from "./providers/DebugConfigProvider";
import { DebugAdapterDescriptorFactory } from "./debugging/DebugAdapterDescriptorFactory";
import { Logger, enableDevModeLogging } from "./Logger";
import vscode from "vscode";
import { setExtensionContext } from "./utilities/extensionContext";

function handleUncaughtErrors() {
  process.on("unhandledRejection", (error) => {
    Logger.error("Unhandled promise rejection", error);
  });
  process.on("uncaughtException", (error: Error) => {
    // @ts-ignore
    if (error.errno === -49) {
      // there is some weird EADDRNOTAVAIL uncaught error thrown in extension host
      // that does not seem to affect anything yet it gets reported here while not being
      // super valuable to the user – hence we ignore it.
      return;
    }
    Logger.error("Uncaught exception", error);
    Logger.openOutputPanel();
    vscode.window.showErrorMessage("Internal extension error.", "Dismiss");
  });
}

export function activate(context: ExtensionContext) {
  handleUncaughtErrors();
  setExtensionContext(context);
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    enableDevModeLogging();
  }

  const showPreviewsPanel = commands.registerCommand(
    "RNStudio.showPreviewsPanel",
    (fileName?: string, lineNumber?: number) => {
      PreviewsPanel.render(context, fileName, lineNumber);
    }
  );

  const reloadMetro = commands.registerCommand(
    "RNStudio.reloadMetro",
    (fileName?: string, lineNumber?: number) => {
      Project.currentProject?.reloadMetro();
    }
  );

  context.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      "com.swmansion.react-native-ide",
      new DebugConfigProvider(),
      DebugConfigurationProviderTriggerKind.Dynamic
    )
  );

  context.subscriptions.push(
    debug.registerDebugAdapterDescriptorFactory(
      "com.swmansion.react-native-ide",
      new DebugAdapterDescriptorFactory()
    )
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      [
        { scheme: "file", language: "typescriptreact" },
        { scheme: "file", language: "javascript" },
      ],
      new PreviewCodeLensProvider()
    )
  );

  // Add command to the extension context
  context.subscriptions.push(showPreviewsPanel);

  context.subscriptions.push(reloadMetro);

  if (process.env.RNSZ_DEV === "true") {
    commands.executeCommand("RNStudio.showPreviewsPanel", (e: any) => {
      Logger.error(e);
    });
  }
}
