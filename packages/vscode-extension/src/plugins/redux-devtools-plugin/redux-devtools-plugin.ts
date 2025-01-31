import { commands, window } from "vscode";
import { ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { ReduxDevToolsPluginWebviewProvider } from "./ReduxDevToolsPluginWebviewProvider";
import { Devtools } from "../../project/devtools";

export const REDUX_PLUGIN_ID = "RNIDE-redux-devtools";
const REDUX_PLUGIN_PREFIX = "RNIDE.Tool.ReduxDevTools";

let initialzed = false;

function initializeReduxDevPlugin() {
  if (initialzed) {
    return;
  }
  initialzed = true;

  const webviewProvider = new ReduxDevToolsPluginWebviewProvider(extensionContext);

  extensionContext.subscriptions.push(
   window.registerWebviewViewProvider(
     `${REDUX_PLUGIN_PREFIX}.view`,
     webviewProvider,
     { webviewOptions: { retainContextWhenHidden: true } }
   )
 );

 return webviewProvider;
}

export const createReduxDevtools = (devtools: Devtools): ToolPlugin => {
   const webViewProvider = initializeReduxDevPlugin();

   webViewProvider?.setListener((webview) => {
      devtools.addListener((event, payload) => {
         webview.webview.postMessage({ 
            scope: event, 
            data: payload
         });
      });

      webview.webview.onDidReceiveMessage((message) => {
         const {scope, ...data} = message;
         devtools.send(scope, data);
      });
   });

   return {
      id: REDUX_PLUGIN_ID,
      label: "Redux DevTools",
      available: true,
      activate: () => {
         commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, true);
      },
      deactivate: () => {
         commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, false);
      },
      openTool: () => {
         commands.executeCommand(`${REDUX_PLUGIN_PREFIX}.view.focus`);
      },
      dispose: () => {},
   };
};
