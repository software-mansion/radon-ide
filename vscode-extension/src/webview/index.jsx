import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import GlobalStateProvider from "./providers/GlobalStateProvider";
import DependenciesProvider from "./providers/DependenciesProvider";
import ModalProvider from "./providers/ModalProvider";

import "./styles/colors.css";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <GlobalStateProvider>
      <DependenciesProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </DependenciesProvider>
    </GlobalStateProvider>
  </React.StrictMode>
);
