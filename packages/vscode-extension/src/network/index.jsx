import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import NetworkProvider from "./providers/NetworkProvider";
import HighlightCacheProvider from "./providers/HighlighterCacheProvider";

import "../webview/styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HighlightCacheProvider>
      <NetworkProvider>
        <App />
      </NetworkProvider>
    </HighlightCacheProvider>
  </React.StrictMode>
);
