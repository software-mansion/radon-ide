import {
  commands,
  languages,
  debug,
  window,
  workspace,
  ExtensionContext,
  ExtensionMode,
  ConfigurationChangeEvent,
  DebugConfigurationProviderTriggerKind,
  DebugAdapterExecutable,
} from "vscode";
import vscode from "vscode";
import { activate as activateJsDebug } from "vscode-js-debug/dist/src/extension";
import { TabPanel, TabPanelSerializer } from "./panels/Tabpanel";
import { PreviewCodeLensProvider } from "./providers/PreviewCodeLensProvider";
import { DebugConfigProvider } from "./providers/DebugConfigProvider";
import {
  CDPDebugAdapterDescriptorFactory,
  DebugAdapterDescriptorFactory,
} from "./debugging/DebugAdapterDescriptorFactory";
import { Logger, enableDevModeLogging } from "./Logger";
import {
  extensionContext,
  findAppRootFolder,
  setExtensionContext,
} from "./utilities/extensionContext";
import { SidePanelViewProvider } from "./panels/SidepanelViewProvider";
import { PanelLocation } from "./common/WorkspaceConfig";
import { Platform } from "./utilities/platform";
import { IDE } from "./project/ide";
import { registerChat } from "./chat";
import { ProxyDebugSessionAdapterDescriptorFactory } from "./debugging/ProxyDebugAdapter";
import { Connector } from "./connect/Connector";
import { ReactDevtoolsEditorProvider } from "./react-devtools-profiler/ReactDevtoolsEditorProvider";
import { IDEPanelMoveTarget } from "./common/utils";

const CHAT_ONBOARDING_COMPLETED = "chat_onboarding_completed";

function handleUncaughtErrors(context: ExtensionContext) {
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
    if (context.extensionMode === ExtensionMode.Development) {
      window.showErrorMessage("Internal extension error.", "Dismiss");
    }
  });
}

export function deactivate(context: ExtensionContext): undefined {
  TabPanel.currentPanel?.dispose();
  SidePanelViewProvider.currentProvider?.dispose();
  IDE.getInstanceIfExists()?.dispose();
  commands.executeCommand("setContext", "RNIDE.extensionIsActive", false);
  commands.executeCommand("setContext", "RNIDE.sidePanelIsClosed", false);
  return undefined;
}

export async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    window.registerWebviewPanelSerializer(TabPanel.viewType, new TabPanelSerializer())
  );

  handleUncaughtErrors(context);
  await activateJsDebug(context);

  if (Platform.OS !== "macos" && Platform.OS !== "windows" && Platform.OS !== "linux") {
    window.showErrorMessage("Radon IDE works only on macOS, Windows and Linux.", "Dismiss");
    return;
  }

  setExtensionContext(context);
  if (context.extensionMode === ExtensionMode.Development) {
    enableDevModeLogging();
  }

  migrateOldConfiguration();

  commands.executeCommand("setContext", "RNIDE.sidePanelIsClosed", false);

  // this flag is used to prevent re-entry for showIDEPanel method, inside this method
  // we update the configuration, and this method is also called as a result of configuration
  // change such that we can monitor the changes that users make directly from the VSCode settings
  let updatingConfigProgrammatically = false;

  async function showIDEPanel(newLocation?: IDEPanelMoveTarget) {
    if (updatingConfigProgrammatically) {
      return;
    }
    await commands.executeCommand("setContext", "RNIDE.sidePanelIsClosed", false);

    const configuration = workspace.getConfiguration("RadonIDE");

    let panelLocation = configuration.get<PanelLocation>("panelLocation");
    if (newLocation) {
      panelLocation = newLocation === "side-panel" ? "side-panel" : "tab";
      updatingConfigProgrammatically = true;
      if (configuration.inspect("panelLocation")?.workspaceValue) {
        await configuration.update("panelLocation", panelLocation, false);
      } else {
        await configuration.update("panelLocation", panelLocation, true);
      }
      updatingConfigProgrammatically = false;
    }

    if (panelLocation !== "tab") {
      SidePanelViewProvider.showView();
    } else {
      let tabNewLocation: "new-window" | "editor-tab" | undefined;
      if (newLocation === "new-window") {
        tabNewLocation = "new-window";
      } else if (newLocation === "editor-tab") {
        tabNewLocation = "editor-tab";
      }
      TabPanel.show(tabNewLocation);
    }
  }

  async function closeIDEPanel(fileName?: string, lineNumber?: number) {
    const panelLocation = workspace
      .getConfiguration("RadonIDE")
      .get<PanelLocation>("panelLocation");

    if (panelLocation !== "tab") {
      commands.executeCommand("setContext", "RNIDE.sidePanelIsClosed", true);
    } else {
      TabPanel.currentPanel?.dispose();
    }
  }

  function closeWithConfirmation() {
    window
      .showWarningMessage("Are you sure you want to close the IDE panel?", "Yes", "No")
      .then((item) => {
        if (item === "Yes") {
          commands.executeCommand("RNIDE.closePanel");
        }
      });
  }

  async function showStorybookStory(componentTitle: string, storyName: string) {
    commands.executeCommand("RNIDE.openPanel");
    const ide = IDE.getInstanceIfExists();
    if (ide) {
      ide.project.showStorybookStory(componentTitle, storyName);
    } else {
      window.showWarningMessage("Wait for the app to load before launching storybook.", "Dismiss");
    }
  }

  async function showInlinePreview(fileName: string, lineNumber: number) {
    commands.executeCommand("RNIDE.openPanel");
    const ide = IDE.getInstanceIfExists();
    if (ide) {
      ide.project.openComponentPreview(fileName, lineNumber);
    } else {
      window.showWarningMessage("Wait for the app to load before launching preview.", "Dismiss");
    }
  }

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      SidePanelViewProvider.viewType,
      new SidePanelViewProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
  context.subscriptions.push(ReactDevtoolsEditorProvider.register(context));
  context.subscriptions.push(
    commands.registerCommand("RNIDE.performBiometricAuthorization", performBiometricAuthorization)
  );
  context.subscriptions.push(
    commands.registerCommand(
      "RNIDE.performFailedBiometricAuthorization",
      performFailedBiometricAuthorization
    )
  );
  context.subscriptions.push(
    commands.registerCommand("RNIDE.deviceHomeButtonPress", deviceHomeButtonPress)
  );
  context.subscriptions.push(
    commands.registerCommand("RNIDE.deviceAppSwitchButtonPress", deviceAppSwitchButtonPress)
  );
  context.subscriptions.push(commands.registerCommand("RNIDE.openDevMenu", openDevMenu));
  context.subscriptions.push(commands.registerCommand("RNIDE.closePanel", closeIDEPanel));
  context.subscriptions.push(commands.registerCommand("RNIDE.openPanel", showIDEPanel));
  context.subscriptions.push(commands.registerCommand("RNIDE.showPanel", showIDEPanel));
  context.subscriptions.push(
    commands.registerCommand("RNIDE.closeWithConfirmation", closeWithConfirmation)
  );
  context.subscriptions.push(
    commands.registerCommand("RNIDE.diagnose", diagnoseWorkspaceStructure)
  );
  context.subscriptions.push(
    commands.registerCommand("RNIDE.showStorybookStory", showStorybookStory)
  );
  context.subscriptions.push(
    commands.registerCommand("RNIDE.showInlinePreview", showInlinePreview)
  );

  context.subscriptions.push(commands.registerCommand("RNIDE.captureReplay", captureReplay));
  context.subscriptions.push(commands.registerCommand("RNIDE.toggleRecording", toggleRecording));
  context.subscriptions.push(
    commands.registerCommand("RNIDE.captureScreenshot", captureScreenshot)
  );
  context.subscriptions.push(commands.registerCommand("RNIDE.openChat", openChat));

  // Debug adapter used by custom launch configuration, we register it in case someone tries to run the IDE configuration
  // The current workflow is that people shouldn't run it, but since it is listed under launch options it might happen
  // When it does happen, we open the IDE panel and restart the app.
  context.subscriptions.push(
    debug.registerDebugAdapterDescriptorFactory(
      "react-native-ide", // we use previous type name here to support old launch configurations that were using "react-native-ide" type
      new LaunchConfigDebugAdapterDescriptorFactory()
    )
  );
  context.subscriptions.push(
    debug.registerDebugAdapterDescriptorFactory(
      "radon-ide",
      new LaunchConfigDebugAdapterDescriptorFactory()
    )
  );

  // Debug adapter used for debugging React Native apps
  context.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      "com.swmansion.react-native-debugger",
      new DebugConfigProvider(),
      DebugConfigurationProviderTriggerKind.Dynamic
    )
  );

  context.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      "com.swmansion.js-debugger",
      new DebugConfigProvider(),
      DebugConfigurationProviderTriggerKind.Dynamic
    )
  );

  context.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      "com.swmansion.proxy-debugger",
      new DebugConfigProvider(),
      DebugConfigurationProviderTriggerKind.Dynamic
    )
  );

  context.subscriptions.push(
    debug.registerDebugAdapterDescriptorFactory(
      "com.swmansion.react-native-debugger",
      new DebugAdapterDescriptorFactory()
    )
  );
  context.subscriptions.push(
    debug.registerDebugAdapterDescriptorFactory(
      "com.swmansion.js-debugger",
      new CDPDebugAdapterDescriptorFactory()
    )
  );

  context.subscriptions.push(
    debug.registerDebugAdapterDescriptorFactory(
      "com.swmansion.proxy-debugger",
      new ProxyDebugSessionAdapterDescriptorFactory()
    )
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      [
        { scheme: "file", language: "typescriptreact" },
        { scheme: "file", language: "javascriptreact" },
        { scheme: "file", language: "typescript" },
        { scheme: "file", language: "javascript" },
      ],
      new PreviewCodeLensProvider()
    )
  );

  context.subscriptions.push(
    workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (event.affectsConfiguration("RadonIDE.panelLocation")) {
        showIDEPanel();
      }
    })
  );

  // You can configure the chat in package.json under the `chatParticipants` key
  registerChat(context);

  const shouldExtensionActivate = findAppRootFolder() !== undefined;

  if (shouldExtensionActivate) {
    extensionActivated(context);
  }
}

class LaunchConfigDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    commands.executeCommand("RNIDE.openPanel");
    // we can't return undefined or throw here because then VSCode displays an ugly error dialog
    // so we return a dummy adapter that calls echo command and exists immediately
    return new DebugAdapterExecutable("echo", ["noop"]);
  }
}

function extensionActivated(context: ExtensionContext) {
  commands.executeCommand("setContext", "RNIDE.extensionIsActive", true);
  if (context.extensionMode === ExtensionMode.Development) {
    // "Connector" implements experimental functionality that is available in development mode only
    Connector.getInstance().start();
  }
}

async function openDevMenu() {
  IDE.getInstanceIfExists()?.project.openDevMenu();
}

async function performBiometricAuthorization() {
  IDE.getInstanceIfExists()?.project.sendBiometricAuthorization(true);
}

async function performFailedBiometricAuthorization() {
  IDE.getInstanceIfExists()?.project.sendBiometricAuthorization(false);
}

async function deviceHomeButtonPress() {
  const project = IDE.getInstanceIfExists()?.project;
  project?.dispatchButton("home", "Down");
  project?.dispatchButton("home", "Up");
}

async function deviceAppSwitchButtonPress() {
  const project = IDE.getInstanceIfExists()?.project;
  project?.dispatchButton("appSwitch", "Down");
  project?.dispatchButton("appSwitch", "Up");
}

async function captureReplay() {
  IDE.getInstanceIfExists()?.project.captureReplay();
}

async function toggleRecording() {
  IDE.getInstanceIfExists()?.project.toggleRecording();
}

async function captureScreenshot() {
  IDE.getInstanceIfExists()?.project.captureScreenshot();
}

async function openChat() {
  let prompt = undefined;

  if (!extensionContext.globalState.get(CHAT_ONBOARDING_COMPLETED)) {
    prompt = "@radon what is Radon IDE?";
    extensionContext.globalState.update(CHAT_ONBOARDING_COMPLETED, true);
  }

  commands.executeCommand("workbench.action.chat.open", prompt);
}

async function diagnoseWorkspaceStructure() {
  const appRootFolder = findAppRootFolder() !== undefined;
  if (appRootFolder) {
    commands.executeCommand("setContext", "RNIDE.extensionIsActive", true);
    window
      .showInformationMessage(
        `
          Workspace structure seems to be ok.\n
          You can open the IDE Panel using the button below or from the command palette.`,
        "Open IDE Panel",
        "Cancel"
      )
      .then((item) => {
        if (item === "Open IDE Panel") {
          commands.executeCommand("RNIDE.openPanel");
        }
      });
  }
}

function migrateOldConfiguration() {
  // At the moment of migration, all configuration settings are considered "global"
  // in a sense that while they can potentially be set workspace-wide, they are not
  // intended to, and hence we are only interested in migrating global settings.

  // We ignore all potential errors that may occur in the process of migration.
  // The current settings are not as critical to break user experience in case any
  // of the method throws

  try {
    const oldConfiguration = workspace.getConfiguration("ReactNativeIDE");
    const newConfigurations = workspace.getConfiguration("RadonIDE");
    // iterate over all keys and set the in the new configuration
    for (const key in oldConfiguration) {
      try {
        if (oldConfiguration.has(key)) {
          const valueDetails = oldConfiguration.inspect(key);
          if (valueDetails?.globalValue) {
            newConfigurations.update(key, valueDetails.globalValue, true);
            oldConfiguration.update(key, valueDetails.defaultValue, true);
          }
        }
      } catch (e) {
        Logger.error("Error when migrating parameter", key, e);
      }
    }
  } catch (e) {
    Logger.error("Error when migrating old configuration", e);
  }
}
