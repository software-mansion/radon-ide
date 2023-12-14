import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import GlobalStateProvider from "./components/GlobalStateContext";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <GlobalStateProvider>
      <App />
    </GlobalStateProvider>
  </React.StrictMode>
);
