import { PropsWithChildren, useContext, createContext, useState, useEffect } from "react";
import { makeProxy } from "../utilities/rpc";
import { DeviceSettings, ProjectInterface, ProjectState, ToolsState } from "../../common/Project";

const project = makeProxy<ProjectInterface>("Project");

interface ProjectContextProps {
  projectState: ProjectState;
  deviceSettings: DeviceSettings;
  toolsState: ToolsState;
  project: ProjectInterface;
  hasActiveLicense: boolean;
}

const defaultProjectState: ProjectState = {
  status: "starting",
  previewURL: undefined,
  selectedDevice: undefined,
  previewZoom: undefined,
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
};

const ProjectContext = createContext<ProjectContextProps>({
  projectState: defaultProjectState,
  deviceSettings: defaultDeviceSettings,
  toolsState: {},
  project,
  hasActiveLicense: false,
});

export default function ProjectProvider({ children }: PropsWithChildren) {
  const [projectState, setProjectState] = useState<ProjectState>(defaultProjectState);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [toolsState, setToolsState] = useState<ToolsState>({});
  const [hasActiveLicense, setHasActiveLicense] = useState(true);

  useEffect(() => {
    project.getProjectState().then(setProjectState);
    project.addListener("projectStateChanged", setProjectState);

    project.getDeviceSettings().then(setDeviceSettings);
    project.addListener("deviceSettingsChanged", setDeviceSettings);

    project.hasActiveLicense().then(setHasActiveLicense);
    project.addListener("licenseActivationChanged", setHasActiveLicense);

    project.getToolsState().then(setToolsState);
    project.addListener("toolsStateChanged", setToolsState);

    return () => {
      project.removeListener("projectStateChanged", setProjectState);
      project.removeListener("deviceSettingsChanged", setDeviceSettings);
      project.removeListener("licenseActivationChanged", setHasActiveLicense);
      project.removeListener("toolsStateChanged", setToolsState);
    };
  }, []);

  return (
    <ProjectContext.Provider
      value={{ projectState, toolsState, deviceSettings, project, hasActiveLicense }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
