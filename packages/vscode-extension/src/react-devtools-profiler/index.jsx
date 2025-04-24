import { createRoot } from "react-dom/client";
import {
  createBridge as createFrontendBridge,
  createStore,
  initialize as createDevTools,
} from "react-devtools-inline/frontend";

import { vscode } from "../webview/utilities/vscode";
import "../webview/styles/theme.css";
import { prepareProfilingDataFrontendFromExport } from "../../third-party/react-devtools/headless";

const wall = {
  _listeners: [],
  listen(listener) {
    wall._listeners.push(listener);
  },
  send(event, payload) {
    wall._listeners.forEach((listener) => listener({ event, payload }));
  },
};

const bridge = createFrontendBridge(window, wall);
const store = createStore(bridge);
const DevTools = createDevTools(window, { bridge, store });

createRoot(document.getElementById("root")).render(
  <DevTools
    browserTheme="dark"
    showTabBar={false}
    hideSettings={true}
    readOnly={true}
    overrideTab="profiler"
    warnIfLegacyBackendDetected={true}
    enabledInspectedElementContextMenu={true}
  />
);

window.addEventListener("message", (event) => {
  if (event.data.type === "profiler-data") {
    store.profilerStore.profilingData = prepareProfilingDataFrontendFromExport(
      JSON.parse(event.data.data)
    );
  }
});
vscode.postMessage({ type: "ready" });
