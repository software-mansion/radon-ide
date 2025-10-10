import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import NetworkProvider from "./providers/NetworkProvider";

import "../webview/styles/theme.css";
import LogDetailsBarProvider from "./providers/LogDetailsBar";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NetworkProvider>
      <LogDetailsBarProvider>
        <App />
      </LogDetailsBarProvider>
    </NetworkProvider>
  </React.StrictMode>
);
