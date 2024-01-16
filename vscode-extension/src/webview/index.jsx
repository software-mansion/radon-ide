import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DevicesProvider from "./providers/DevicesProvider";
import DependenciesProvider from "./providers/DependenciesProvider";
import ModalProvider from "./providers/ModalProvider";

import "./styles/colors.css";
import ProjectProvider from "./providers/ProjectProvider";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ProjectProvider>
      <DevicesProvider>
        <DependenciesProvider>
          <ModalProvider>
            <App />
          </ModalProvider>
        </DependenciesProvider>
      </DevicesProvider>
    </ProjectProvider>
  </React.StrictMode>
);
