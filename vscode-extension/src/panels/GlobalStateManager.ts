import { ExtensionContext, Webview } from "vscode";

export class GlobalStateManager {
  private context: ExtensionContext;
  private webview: Webview;

  constructor(context: ExtensionContext, webview: Webview) {
    this.context = context;
    this.webview = webview;
  }

  startListening() {
    this.webview.onDidReceiveMessage((message: any) => {
      const command = message.command;
      switch (command) {
        case "setState":
          this.context.globalState.update("webviewState", message.state);
          break;
        case "getState":
          this.webview.postMessage({
            command: "getState",
            state: this.context.globalState.get("webviewState"),
          });
          break;
      }
    });
  }
}
