import {
  PropsWithChildren,
  useContext,
  createContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { makeProxy } from "../utilities/rpc";
import { WorkspaceConfig, WorkspaceConfigProps } from "../../common/WorkspaceConfig";

const workspaceConfig = makeProxy<WorkspaceConfig>("WorkspaceConfig");

type WorkspaceConfigContextType = WorkspaceConfigProps & {
  updateUserLevel: <K extends keyof WorkspaceConfigProps>(
    key: K,
    value: WorkspaceConfigProps[K]
  ) => void;
};

const WorkspaceConfigContext = createContext<WorkspaceConfigContextType>({
  panelLocation: "tab",
  relativeAppLocation: "",
  updateUserLevel: () => {},
});

export default function WorkspaceConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<WorkspaceConfigProps>({
    panelLocation: "tab",
    relativeAppLocation: "",
  });

  useEffect(() => {
    workspaceConfig.getConfig().then(setConfig);
    workspaceConfig.addListener("configChange", setConfig);

    return () => {
      workspaceConfig.removeListener("configChange", setConfig);
    };
  }, []);

  const updateUserLevel = useCallback(
    <K extends keyof WorkspaceConfigProps>(
      key: K,
      value: WorkspaceConfigProps[K],
      configurationTarget?: boolean
    ) => {
      const newState = { ...config, [key]: value };
      setConfig(newState);
      workspaceConfig.updateUserLevel(key, value);
    },
    [config, setConfig]
  );

  return (
    <WorkspaceConfigContext.Provider value={{ ...config, updateUserLevel }}>
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
