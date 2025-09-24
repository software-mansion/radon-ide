import { Disposable } from "vscode";
import { ArchitectureStrategy, BroadcastListener } from "./network-plugin";
import { WebviewMessage } from "../../network/types/panelMessageProtocol";

export abstract class BaseArchitectureStrategy implements ArchitectureStrategy {
  protected broadcastListeners: BroadcastListener[] = [];

  public onMessageBroadcast(cb: BroadcastListener): Disposable {
    this.broadcastListeners.push(cb);
    return new Disposable(() => {
      let index = this.broadcastListeners.indexOf(cb);
      if (index !== -1) {
        this.broadcastListeners.splice(index, 1);
      }
    });
  }

  protected broadcastMessage(message: Parameters<BroadcastListener>[0]): void {
    this.broadcastListeners.forEach((cb) => cb(message));
  }

  abstract activate(): void;
  abstract deactivate(): void;
  abstract openTool(): void;
  abstract dispose(): void;
  abstract handleWebviewMessage(message: WebviewMessage): void;
  abstract readonly pluginAvailable: boolean;
}
