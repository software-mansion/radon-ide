import {
  PropsWithChildren,
  useContext,
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { makeProxy } from "../utilities/rpc";
import { WorkspaceConfig, WorkspaceConfigProps } from "../../common/WorkspaceConfig";

const workspaceConfig = makeProxy<WorkspaceConfig>("WorkspaceConfig");

type WorkspaceConfigContextType = WorkspaceConfigProps & {
  update: <K extends keyof WorkspaceConfigProps>(key: K, value: WorkspaceConfigProps[K]) => void;
};

const WorkspaceConfigContext = createContext<WorkspaceConfigContextType>({
  panelLocation: "tab",
  showDeviceFrame: true,
  update: () => {},
});

export default function WorkspaceConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<WorkspaceConfigProps>({
    panelLocation: "tab",
    showDeviceFrame: true,
  });

  useEffect(() => {
    workspaceConfig.getConfig().then(setConfig);
    workspaceConfig.addListener("configChange", setConfig);

    return () => {
      workspaceConfig.removeListener("configChange", setConfig);
    };
  }, []);

  const update = useCallback(
    <K extends keyof WorkspaceConfigProps>(
      key: K,
      value: WorkspaceConfigProps[K],
      configurationTarget?: boolean
    ) => {
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
