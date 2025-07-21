import {
  PropsWithChildren,
  useContext,
  createContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { makeProxy } from "../utilities/rpc";
import { WorkspaceConfig, WorkspaceConfigProps } from "../../common/WorkspaceConfig";
import { DeviceRotationType } from "../../common/Project";

const workspaceConfig = makeProxy<WorkspaceConfig>("WorkspaceConfig");

type WorkspaceConfigContextType = WorkspaceConfigProps & {
  update: <K extends keyof WorkspaceConfigProps>(key: K, value: WorkspaceConfigProps[K]) => void;
};

const INITIAL_WORKSPACE_CONFIG: WorkspaceConfigProps = {
  panelLocation: "tab",
  showDeviceFrame: true,
  stopPreviousDevices: false,
  deviceRotation: DeviceRotationType.Portrait,
};

const WorkspaceConfigContext = createContext<WorkspaceConfigContextType>({
  ...INITIAL_WORKSPACE_CONFIG,
  update: () => {},
});

export default function WorkspaceConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<WorkspaceConfigProps>(INITIAL_WORKSPACE_CONFIG);

  useEffect(() => {
    function watchConfigChange(e: WorkspaceConfigProps) {
      setConfig(e);
    }

    workspaceConfig.getConfig().then(watchConfigChange);
    workspaceConfig.addListener("configChange", watchConfigChange);

    return () => {
      workspaceConfig.removeListener("configChange", watchConfigChange);
    };
  }, []);

  const update = useCallback(
    <K extends keyof WorkspaceConfigProps>(key: K, value: WorkspaceConfigProps[K]) => {
      const newState = { ...config, [key]: value };
      setConfig(newState);
      workspaceConfig.update(key, value);
    },
    [config, setConfig]
  );

  const contextValue = useMemo(() => {
    return { ...config, update };
  }, [config, update]);

  return (
    <WorkspaceConfigContext.Provider value={contextValue}>
      {children}
    </WorkspaceConfigContext.Provider>
  );
}

export function useWorkspaceConfig() {
  const context = useContext(WorkspaceConfigContext);

  if (context === undefined) {
    throw new Error("useWorkspaceConfig must be used within a WorkspaceConfigProvider");
  }
  return context;
}
