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
import { Logger } from "./Logger";
import { dumpLogsToFile } from "./utilities/common";
import vscode from "vscode";

function handleUncaughtErrors() {
  process.on("unhandledRejection", (error) => {
    Logger.error(`Uncaught Rejection: ${error}`);
    vscode.window.showErrorMessage("Internal extension error.");
    dumpLogsToFile(error);
    if (PreviewsPanel.currentPanel) {
      PreviewsPanel.currentPanel.handleProcessError(error);
    }
  });

  process.on("uncaughtException", (error) => {
    Logger.error(`Uncaught Exception: ${error}`);
    vscode.window.showErrorMessage("Internal extension error.");
    dumpLogsToFile(error);
    if (PreviewsPanel.currentPanel) {
      PreviewsPanel.currentPanel.handleProcessError(error);
    }
  });
}

export function activate(context: ExtensionContext) {
  Logger.setLogLevel("INFO");
  Logger.changeConsoleLogMode(true);
  handleUncaughtErrors();

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
      "com.swmansion.react-native-preview",
      new DebugConfigProvider(),
      DebugConfigurationProviderTriggerKind.Dynamic
    )
  );

  context.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      "pwa-node",
      new DebugConfigProvider(),
      DebugConfigurationProviderTriggerKind.Dynamic
    )
  );

  context.subscriptions.push(
    debug.registerDebugAdapterDescriptorFactory(
      "com.swmansion.react-native-preview",
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
