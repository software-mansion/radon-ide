import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createBridge as createFrontendBridge,
  createStore,
  initialize as createDevTools,
} from "react-devtools-inline/frontend";

import { vscode } from "../webview/utilities/vscode";
import "../webview/styles/theme.css";
import "./App.css";
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

function getBrowserTheme() {
  // dark is used both for vscode-dark and vscode-high-contrast-dark
  // otherwise it's light
  return document.body.getAttribute("data-vscode-theme-kind").startsWith("vscode-dark")
    ? "dark"
    : "light";
}

function DevToolsWrapper() {
  const [browserTheme, setBrowserTheme] = useState(getBrowserTheme());

  useEffect(() => {
    const updateTheme = () => {
      setBrowserTheme(getBrowserTheme());
    };

    const observer = new MutationObserver(updateTheme);

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-vscode-theme-kind"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const listener = (event) => {
      if (event.data.type === "profiler-data") {
        store.profilerStore.profilingData = prepareProfilingDataFrontendFromExport(
          JSON.parse(event.data.data)
        );
      }
    };
    window.addEventListener("message", listener);
    vscode.postMessage({ type: "ready" });
    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  return (
    <DevTools
      browserTheme={browserTheme}
      showTabBar={false}
      hideSettings={true}
      readOnly={true}
      overrideTab="profiler"
      warnIfLegacyBackendDetected={true}
      enabledInspectedElementContextMenu={true}
    />
  );
}

createRoot(document.getElementById("root")).render(<DevToolsWrapper />);
