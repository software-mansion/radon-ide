import { PropsWithChildren, useContext, createContext, useState, useEffect, useMemo } from "react";
import { makeProxy } from "../utilities/rpc";
import { DeviceSettings, ProjectInterface, ProjectState } from "../../common/Project";
import { LaunchConfigurationKind } from "../../common/LaunchConfig";

declare global {
  interface Window {
    // set in generateWebviewContent()
    RNIDE_hostOS: "macos" | "windows" | "linux";
    RNIDE_isDev: boolean;
  }
}

export const IS_DEV = window.RNIDE_isDev;

export const Platform = {
  OS: window.RNIDE_hostOS,
  select: <R, T>(obj: { macos: R; windows: T; linux: T }) => {
    return obj[Platform.OS];
  },
};

const project = makeProxy<ProjectInterface>("Project");

interface ProjectContextProps {
  projectState: ProjectState;
  deviceSettings: DeviceSettings;
  project: ProjectInterface;
  hasActiveLicense: boolean;
}

const defaultProjectState: ProjectState = {
  appRootPath: "./",
  customLaunchConfigurations: [],
  selectedLaunchConfiguration: {
    kind: LaunchConfigurationKind.Detected,
    appRoot: "./",
    env: {},
  },
  connectState: {
    enabled: false,
    connected: false,
  },
};

const defaultDeviceSettings: DeviceSettings = {
  appearance: "dark",
  contentSize: "normal",
  hasEnrolledBiometrics: false,
  location: {
    latitude: 50.048653,
    longitude: 19.965474,
    isDisabled: false,
  },
  locale: "en_US",
  replaysEnabled: false,
  showTouches: false,
  camera: {
    back: "virtualscene",
    front: "emulated",
  },
};

const ProjectContext = createContext<ProjectContextProps>({
  projectState: defaultProjectState,
  deviceSettings: defaultDeviceSettings,
  project,
  hasActiveLicense: false,
});

export default function ProjectProvider({ children }: PropsWithChildren) {
  const [projectState, setProjectState] = useState<ProjectState>(defaultProjectState);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [hasActiveLicense, setHasActiveLicense] = useState(true);

  useEffect(() => {
    project.getProjectState().then(setProjectState);
    project.addListener("projectStateChanged", setProjectState);

    project.getDeviceSettings().then(setDeviceSettings);
    project.addListener("deviceSettingsChanged", setDeviceSettings);

    project.hasActiveLicense().then(setHasActiveLicense);
    project.addListener("licenseActivationChanged", setHasActiveLicense);

    return () => {
      project.removeListener("projectStateChanged", setProjectState);
      project.removeListener("deviceSettingsChanged", setDeviceSettings);
      project.removeListener("licenseActivationChanged", setHasActiveLicense);
    };
  }, []);

  const contextValue = useMemo(() => {
    return {
      projectState,
      deviceSettings,
      project,
      hasActiveLicense,
    };
  }, [projectState, deviceSettings, project, hasActiveLicense]);

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

export function installLogOverrides() {
  function wrapConsole(methodName: "log" | "info" | "warn" | "error") {
    const consoleMethod = console[methodName];
    console[methodName] = (message: string, ...args: any[]) => {
      project.log(methodName, message, ...args);
      consoleMethod(message, ...args);
    };
  }

  (["log", "info", "warn", "error"] as const).forEach(wrapConsole);

  // install uncaught exception handler
  window.addEventListener("error", (event) => {
    project.log("error", "Uncaught exception", event.error.stack);
    // rethrow the error to be caught by the global error handler
    throw event.error;
  });

  // install uncaught promise rejection handler
  window.addEventListener("unhandledrejection", (event) => {
    project.log("error", "Uncaught promise rejection", event.reason);
    // rethrow the error to be caught by the global error handler
    throw event.reason;
  });
}
