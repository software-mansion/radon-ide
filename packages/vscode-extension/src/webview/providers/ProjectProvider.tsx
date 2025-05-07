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
  DeviceSettings,
  MultimediaData,
  ProjectInterface,
  ProjectState,
  StartupMessage,
  ToolsState,
} from "../../common/Project";

const project = makeProxy<ProjectInterface>("Project");

interface ProjectContextProps {
  projectState: ProjectState;
  deviceSettings: DeviceSettings;
  toolsState: ToolsState;
  project: ProjectInterface;
  hasActiveLicense: boolean;
  replayData: MultimediaData | undefined;
  setReplayData: Dispatch<SetStateAction<MultimediaData | undefined>>;
  isRecording: boolean;
  isProfilingCPU: boolean;
  isProfilingReact: boolean;
  isSavingReactProfile: boolean;
}

const defaultProjectState: ProjectState = {
  status: "starting",
  startupMessage: StartupMessage.InitializingDevice,
  stageProgress: 0,
  previewURL: undefined,
  selectedDevice: undefined,
  previewZoom: undefined,
  initialized: false,
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
  replayData: undefined,
  setReplayData: () => {},
  isRecording: false,
  isProfilingCPU: false,
  isProfilingReact: false,
  isSavingReactProfile: false,
});

export default function ProjectProvider({ children }: PropsWithChildren) {
  const [projectState, setProjectState] = useState<ProjectState>(defaultProjectState);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [toolsState, setToolsState] = useState<ToolsState>({});
  const [hasActiveLicense, setHasActiveLicense] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProfilingCPU, setIsProfilingCPU] = useState(false);
  const [isProfilingReact, setIsProfilingReact] = useState(false);
  const [isSavingReactProfile, setIsSavingReactProfile] = useState(false);
  const [replayData, setReplayData] = useState<MultimediaData | undefined>(undefined);

  useEffect(() => {
    project.getProjectState().then(setProjectState);
    project.addListener("projectStateChanged", setProjectState);

    project.getDeviceSettings().then(setDeviceSettings);
    project.addListener("deviceSettingsChanged", setDeviceSettings);

    project.hasActiveLicense().then(setHasActiveLicense);
    project.addListener("licenseActivationChanged", setHasActiveLicense);

    project.getToolsState().then(setToolsState);
    project.addListener("toolsStateChanged", setToolsState);

    project.addListener("isRecording", setIsRecording);
    project.addListener("replayDataCreated", setReplayData);

    project.addListener("isProfilingCPU", setIsProfilingCPU);
    project.addListener("isProfilingReact", setIsProfilingReact);
    project.addListener("isSavingReactProfile", setIsSavingReactProfile);
    return () => {
      project.removeListener("projectStateChanged", setProjectState);
      project.removeListener("deviceSettingsChanged", setDeviceSettings);
      project.removeListener("licenseActivationChanged", setHasActiveLicense);
      project.removeListener("toolsStateChanged", setToolsState);
    };
  }, []);

  const contextValue = useMemo(() => {
    return {
      projectState,
      deviceSettings,
      project,
      hasActiveLicense,
      toolsState,
      replayData,
      setReplayData,
      isRecording,
      isProfilingCPU,
      isProfilingReact,
      isSavingReactProfile,
    };
  }, [
    projectState,
    deviceSettings,
    project,
    hasActiveLicense,
    toolsState,
    replayData,
    setReplayData,
    isRecording,
    isProfilingCPU,
    isProfilingReact,
    isSavingReactProfile,
  ]);

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
