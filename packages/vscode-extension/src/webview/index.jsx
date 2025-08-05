import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

import ModalProvider from "./providers/ModalProvider";
import ProjectProvider from "./providers/ProjectProvider";
import AlertProvider from "./providers/AlertProvider";

import { UtilsProvider, installLogOverrides } from "./providers/UtilsProvider";

import "./styles/theme.css";
import StoreProvider from "./providers/storeProvider";

installLogOverrides();

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <StoreProvider>
      <ProjectProvider>
        <UtilsProvider>
          <ModalProvider>
            <AlertProvider>
              <App />
            </AlertProvider>
          </ModalProvider>
        </UtilsProvider>
      </ProjectProvider>
    </StoreProvider>
  </React.StrictMode>
);
