import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import NetworkProvider from "./providers/NetworkProvider";
import TabBarProvider from "./providers/TabBarProvider";
import "../webview/styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NetworkProvider>
      <TabBarProvider>
        <App />
      </TabBarProvider>
    </NetworkProvider>
  </React.StrictMode>
);
