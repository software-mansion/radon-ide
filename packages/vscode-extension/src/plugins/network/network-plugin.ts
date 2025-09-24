import { Disposable, window } from "vscode";
import { NetworkBridge, RadonInspectorBridge } from "../../project/bridge";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";

import LegacyArchitecture from "./LegacyArchitectureStrategy";
import NewArchitecture from "./NewArchitectureStrategy";
import { WebviewMessage } from "../../network/types/panelMessageProtocol";

export const NETWORK_PLUGIN_ID = "network";
const NEW_ARCHITECTURE = true;

export interface ArchitectureStrategy {
  activate(): void;
  deactivate(): void;
  openTool(): void;
  dispose(): void;
  onMessageBroadcast(cb: BroadcastListener): Disposable;
  handleWebviewMessage(message: WebviewMessage): void;
  readonly pluginAvailable: boolean;
}

export type BroadcastListener = (message: WebviewMessage) => void;

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
  public readonly persist = true;

  public toolInstalled = false;

  private readonly strategy: ArchitectureStrategy;

  constructor(
    readonly inspectorBridge: RadonInspectorBridge,
    readonly networkBridge: NetworkBridge
  ) {
    this.strategy = NEW_ARCHITECTURE ? new NewArchitecture(this) : new LegacyArchitecture(this);
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

  openTool(): void {
    this.strategy.openTool();
  }

  dispose() {
    this.strategy.dispose();
  }

  public onMessageBroadcast(cb: BroadcastListener): Disposable {
    return this.strategy.onMessageBroadcast(cb);
  }

  handleWebviewMessage(message: WebviewMessage) {
    this.strategy.handleWebviewMessage(message);
  }
}
