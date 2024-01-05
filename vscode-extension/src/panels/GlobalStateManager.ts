import { ExtensionContext, Webview } from "vscode";
import { isFunction, merge } from "lodash";
import { Logger } from "../Logger";

const STATE_NAME = "react-native-sztudio";

export class GlobalStateManager {
  private context: ExtensionContext;
  private webview: Webview;

  constructor(context: ExtensionContext, webview: Webview) {
    this.context = context;
    this.webview = webview;
  }

  public updateState(stateUpdate: any) {
    const presentState = this.getState();
    let newState = stateUpdate;
    if (isFunction(stateUpdate)) {
      newState = stateUpdate(presentState);
    }
    this.context.workspaceState.update(STATE_NAME, newState);
  }

  public getState(): any {
    return this.context.workspaceState.get(STATE_NAME);
  }

  startListening() {
    this.webview.onDidReceiveMessage((message: any) => {
      const command = message.command;
      switch (command) {
        case "setState":
          this.updateState((currentState: any) => merge(currentState, message.state));
          break;
        case "getState":
          this.webview.postMessage({
            command: "getState",
            state: this.getState(),
          });
          break;
      }
    });
  }
}
