import { commands, Disposable, window } from "vscode";
import { NetworkBridge, RadonInspectorBridge } from "../../project/bridge";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";
import { WebviewMessage } from "../../network/types/panelMessageProtocol";

import LegacyInspectorStrategy from "./strategies/LegacyInspectorStrategy";
import NewInspectorStrategy from "./strategies/NewInspectorStrategy";

export const NETWORK_PLUGIN_ID = "network";
const ENABLE_NEW_INSPECTOR = true;

export type BroadcastListener = (message: WebviewMessage) => void;

export interface InspectorStrategy {
  activate(): void;
  deactivate(): void;
  dispose(): void;
  onMessageBroadcast(cb: BroadcastListener): Disposable;
  handleWebviewMessage(message: WebviewMessage): void;
  readonly pluginAvailable: boolean;
}

let initialized = false;
async function initialize() {
  if (initialized) {
    return;
  }
  Logger.debug("Initilizing Network tool");
  initialized = true;

  const networkDevtoolsWebviewProvider = new NetworkDevtoolsWebviewProvider(extensionContext);

  extensionContext.subscriptions.push(
    networkDevtoolsWebviewProvider,
    window.registerWebviewViewProvider(`RNIDE.Tool.Network.view`, networkDevtoolsWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
}

export class NetworkPlugin implements ToolPlugin {
  public readonly id: ToolKey = NETWORK_PLUGIN_ID;
  public readonly label = "Network";
  public readonly persist = false;
  public toolInstalled = false;

  private readonly strategy: InspectorStrategy;

  constructor(
    readonly inspectorBridge: RadonInspectorBridge,
    readonly networkBridge: NetworkBridge
  ) {
    this.strategy = ENABLE_NEW_INSPECTOR
      ? new NewInspectorStrategy(this)
      : new LegacyInspectorStrategy(this);
    initialize();
  }

  public get pluginAvailable(): boolean {
    return this.strategy.pluginAvailable;
  }

  activate(): void {
    this.strategy.activate();
  }

  deactivate(): void {
    this.strategy.deactivate();
  }

  dispose() {
    this.strategy.dispose();
  }
  
  public openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }
  public onMessageBroadcast(cb: BroadcastListener): Disposable {
    return this.strategy.onMessageBroadcast(cb);
  }
  
  handleWebviewMessage(message: WebviewMessage) {
    this.strategy.handleWebviewMessage(message);
  }
}
