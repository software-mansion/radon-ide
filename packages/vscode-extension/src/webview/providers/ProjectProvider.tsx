import {
  PropsWithChildren,
  useContext,
  createContext,
  useState,
  useEffect,
  Dispatch,
  SetStateAction,
  useMemo,
} from "react";
import { makeProxy } from "../utilities/rpc";
import {
  DeviceSessionState,
  DeviceSettings,
  MultimediaData,
  ProjectInterface,
  ProjectState,
} from "../../common/Project";

const project = makeProxy<ProjectInterface>("Project");

interface ProjectContextProps {
  projectState: ProjectState;
  selectedDeviceSession: DeviceSessionState | undefined;
  deviceSettings: DeviceSettings;
  project: ProjectInterface;
  hasActiveLicense: boolean;
  replayData: MultimediaData | undefined;
  setReplayData: Dispatch<SetStateAction<MultimediaData | undefined>>;
}

const defaultProjectState: ProjectState = {
  selectedSessionId: null,
  deviceSessions: {},
  previewZoom: undefined,
  appRootPath: "./",
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
  selectedDeviceSession: undefined,
  project,
  hasActiveLicense: false,
  replayData: undefined,
  setReplayData: () => {},
});

export default function ProjectProvider({ children }: PropsWithChildren) {
  const [projectState, setProjectState] = useState<ProjectState>(defaultProjectState);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [hasActiveLicense, setHasActiveLicense] = useState(true);
  const [replayData, setReplayData] = useState<MultimediaData | undefined>(undefined);

  useEffect(() => {
    project.getProjectState().then(setProjectState);
    project.addListener("projectStateChanged", setProjectState);

    project.getDeviceSettings().then(setDeviceSettings);
    project.addListener("deviceSettingsChanged", setDeviceSettings);

    project.hasActiveLicense().then(setHasActiveLicense);
    project.addListener("licenseActivationChanged", setHasActiveLicense);

    project.addListener("replayDataCreated", setReplayData);
    return () => {
      project.removeListener("projectStateChanged", setProjectState);
      project.removeListener("deviceSettingsChanged", setDeviceSettings);
      project.removeListener("licenseActivationChanged", setHasActiveLicense);
    };
  }, []);

  const contextValue = useMemo(() => {
    const selectedDeviceSession = projectState.selectedSessionId
      ? projectState.deviceSessions[projectState.selectedSessionId]
      : undefined;
    return {
      projectState,
      selectedDeviceSession,
      deviceSettings,
      project,
      hasActiveLicense,
      replayData,
      setReplayData,
    };
  }, [projectState, deviceSettings, project, hasActiveLicense, replayData, setReplayData]);

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
