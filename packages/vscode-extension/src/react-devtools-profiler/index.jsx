import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBridge as createFrontendBridge,
  createStore,
  initialize as createDevTools,
} from "react-devtools-inline/frontend";

import "../webview/styles/theme.css";

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
  <StrictMode>
    <DevTools />
  </StrictMode>
);
