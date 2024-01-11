import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import WorkspaceStateProvider from "./providers/WorkspaceStateProvider";
import DependenciesProvider from "./providers/DependenciesProvider";
import ModalProvider from "./providers/ModalProvider";

import "./styles/colors.css";
import SystemImagesProvider from "./providers/SystemImagesProvider";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <WorkspaceStateProvider>
      <DependenciesProvider>
        <SystemImagesProvider>
          <ModalProvider>
            <App />
          </ModalProvider>
        </SystemImagesProvider>
      </DependenciesProvider>
    </WorkspaceStateProvider>
  </React.StrictMode>
);
