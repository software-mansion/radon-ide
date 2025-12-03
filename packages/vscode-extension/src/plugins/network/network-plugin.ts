import { commands, Disposable, window } from "vscode";
import { SemVer } from "semver";
import { RadonInspectorBridge } from "../../project/inspectorBridge";
import { NetworkBridge } from "../../project/networkBridge";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";
import { WebviewMessage } from "../../network/types/panelMessageProtocol";

import InspectorBridgeNetworkInspector from "./strategies/InspectorBridgeNetworkInspector";
import DebuggerNetworkInspector from "./strategies/DebuggerNetworkInspector";

export const NETWORK_PLUGIN_ID = "network";

/**
 * Minimum React Native minor version that includes debugger network inspector support
 */
const MINIMUM_RN_DEBUGGER_INSPECTOR_VERSION = 83;

export type BroadcastListener = (message: WebviewMessage) => void;

export interface NetworkInspector {
  enable(): void;
  disable(): void;
  deactivate(): void;
  activate(): void;
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
  public readonly persist = true;
  public toolInstalled = false;

  private readonly networkInspector: NetworkInspector;

  constructor(
    inspectorBridge: RadonInspectorBridge,
    networkBridge: NetworkBridge,
    metroPort: number,
    reactNativeVersion: SemVer | null
  ) {
    this.networkInspector = this.checkDebuggerNetworkInspectorSupport(reactNativeVersion)
      ? new DebuggerNetworkInspector(inspectorBridge, networkBridge, metroPort)
      : new InspectorBridgeNetworkInspector(inspectorBridge, metroPort);
    initialize();
  }

  public get pluginAvailable(): boolean {
    return this.networkInspector.pluginAvailable;
  }

  private checkDebuggerNetworkInspectorSupport(reactNativeVersion: SemVer | null): boolean {
    // using SemVer.compare does not work because it evaluates 0 to false in its implementation
    if (!reactNativeVersion || reactNativeVersion.minor < MINIMUM_RN_DEBUGGER_INSPECTOR_VERSION) {
      return false;
    }
    return true;
  }

  public enable(): void {
    this.networkInspector.enable();
  }

  public disable(): void {
    this.networkInspector.disable();
  }

  public dispose(): void {
    this.networkInspector.dispose();
  }

  public deactivate(): void {
    this.networkInspector.deactivate();
  }

  public activate(): void {
    this.networkInspector.activate();
  }

  public openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }
  public onMessageBroadcast(cb: BroadcastListener): Disposable {
    return this.networkInspector.onMessageBroadcast(cb);
  }

  public handleWebviewMessage(message: WebviewMessage) {
    this.networkInspector.handleWebviewMessage(message);
  }
}
