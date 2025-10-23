import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import NetworkProvider from "./providers/NetworkProvider";
import HighlighterProvider from "./providers/HighlighterProvider";
import TabBarProvider from "./providers/TabBarProvider";
import "../webview/styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HighlighterProvider>
      <NetworkProvider>
        <TabBarProvider>
          <App />
        </TabBarProvider>
      </NetworkProvider>
    </HighlighterProvider>
  </React.StrictMode>
);
