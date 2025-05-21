let initialRoutes = null;
window.addEventListener("message", (event) => {
  if (event.data?.type === "RNIDE_navigationRouteListUpdated") {
    initialRoutes = event.data.routes;
  }
});

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

import DevicesProvider from "./providers/DevicesProvider";
import DependenciesProvider from "./providers/DependenciesProvider";
import ModalProvider from "./providers/ModalProvider";
import ProjectProvider from "./providers/ProjectProvider";
import AlertProvider from "./providers/AlertProvider";
import WorkspaceConfigProvider from "./providers/WorkspaceConfigProvider";
import RoutesProvider from "./providers/RoutesProvider";

import { UtilsProvider, installLogOverrides } from "./providers/UtilsProvider";
import { TelemetryProvider } from "./providers/TelemetryProvider";
import LaunchConfigProvider from "./providers/LaunchConfigProvider";

import "./styles/theme.css";

installLogOverrides();

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ProjectProvider>
      <UtilsProvider>
        <TelemetryProvider>
          <WorkspaceConfigProvider>
            <LaunchConfigProvider>
              <DevicesProvider>
                <DependenciesProvider>
                  <ModalProvider>
                    <AlertProvider>
                      <RoutesProvider initialRoutes={initialRoutes}>
                        <App />
                      </RoutesProvider>
                    </AlertProvider>
                  </ModalProvider>
                </DependenciesProvider>
              </DevicesProvider>
            </LaunchConfigProvider>
          </WorkspaceConfigProvider>
        </TelemetryProvider>
      </UtilsProvider>
    </ProjectProvider>
  </React.StrictMode>
);
