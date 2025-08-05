import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

import ModalProvider from "./providers/ModalProvider";
import ProjectProvider, { installLogOverrides } from "./providers/ProjectProvider";
import AlertProvider from "./providers/AlertProvider";

import "./styles/theme.css";
import StoreProvider from "./providers/storeProvider";

installLogOverrides();

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <StoreProvider>
      <ProjectProvider>
        <ModalProvider>
          <AlertProvider>
            <App />
          </AlertProvider>
        </ModalProvider>
      </ProjectProvider>
    </StoreProvider>
  </React.StrictMode>
);
