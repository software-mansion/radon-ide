import { commands } from "vscode";
import { ArchitectureStrategy, NetworkPlugin } from "./network-plugin";

export default class NewArchitecture implements ArchitectureStrategy {
  // placeholder: until new protocol is implemented, report unavailable by default
  public get pluginAvailable() {
    return true;
  }

  constructor(private plugin: NetworkPlugin) {}

  public activate(): void {
    // Placeholder flow: start websocket backend and register a listener that delegates
    // tool-related events through onToolEvent. Real implementation should wire
    // the new onToolEvent protocol here.
    this.plugin.websocketBackend.start().then(() => {
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    });
  }

  public deactivate(): void {
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  public openTool(): void {
    // same UX: focus the network view
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  public dispose(): void {
    // placeholder
  }

  public websocketMessageHandler(message: any): void {
    // placeholder
  }
}
