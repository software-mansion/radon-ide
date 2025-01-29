import { commands, window } from "vscode";
import { ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { ReduxDevToolsPluginWebviewProvider } from "./ReduxDevToolsPluginWebviewProvider";
import { Devtools } from "../../project/devtools";

export const REDUX_PLUGIN_ID = "redux-devtools";
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

// export function createExpoDevPluginTools(toolsManager: ToolsManager): ToolPlugin[] {
//    initializeReduxDevPlugin();

//   const plugins: ToolPlugin[] = [];

//   function devtoolsListener(event: string, payload: any) {
//     if (event === "RNIDE_expoDevPluginsChanged") {
//       // payload.plugins is a list of expo dev plugin names
//       const availablePlugins = new Set(payload.plugins);
//       for (const plugin of plugins) {
//         plugin.available = availablePlugins.has(plugin.id);
//       }
//       // notify tools manager that the state of requested plugins has changed
//       toolsManager.handleStateChange();
//     }
//   }
//   let disposed = false;
//   function dispose() {
//     if (!disposed) {
//       toolsManager.devtools.removeListener(devtoolsListener);
//       disposed = false;
//     }
//   }

//   for (const [id, pluginInfo] of Object.entries(ExpoDevPluginToolMap)) {
//     plugins.push({
//       id: id as ExpoDevPluginToolName,
//       label: pluginInfo.label,
//       available: false,
//       activate() {
//         commands.executeCommand("setContext", `${pluginInfo.viewIdPrefix}.available`, true);
//       },
//       deactivate() {
//         commands.executeCommand("setContext", `${pluginInfo.viewIdPrefix}.available`, false);
//       },
//       openTool() {
//         commands.executeCommand(`${pluginInfo.viewIdPrefix}.view.focus`);
//       },
//       dispose,
//     });
//   }

//   // Listen for events passed via devtools that indicate which plugins are loaded
//   // by the app.
//   toolsManager.devtools.addListener(devtoolsListener);

//   return plugins;
// }


export const createReduxDevtools = (devtools: Devtools): ToolPlugin => {
   const webViewProvider = initializeReduxDevPlugin();

   devtools.addListener((event, payload) => {
      if (event === "RNIDE_plugins") {
         console.log("Redux DevTools received plugins", event, payload);
         webViewProvider?.postMessage({ 
            command: "redux_log", 
            data: { 
               type: 'ACTION',
               payload: payload.data.state,
               action: payload.data.action,
            }}
         );
      }
   });

   return {
      id: REDUX_PLUGIN_ID,
      label: "Redux DevTools",
      available: true,
      activate: () => {
         console.log("Redux DevTools activated");
         commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, true);
      },
      deactivate: () => {
         console.log("Redux DevTools deactivated");
         commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, false);
      },
      openTool: () => {
         console.log("Redux DevTools opened");
         commands.executeCommand(`${REDUX_PLUGIN_PREFIX}.view.focus`);
      },
      dispose: () => {
         console.log("Redux DevTools disposed");
      },
   };
};
