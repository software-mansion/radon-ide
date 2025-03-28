import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import NetworkProvider from "../providers/NetworkProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NetworkProvider>
      <App />
    </NetworkProvider>
  </React.StrictMode>
);
