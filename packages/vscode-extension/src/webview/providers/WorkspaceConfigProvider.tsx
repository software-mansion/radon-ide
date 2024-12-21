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
  update: () => { },
  themeType: 'vscode',
});

export default function WorkspaceConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<WorkspaceConfigProps>({
    panelLocation: "tab",
    showDeviceFrame: true,
    themeType: 'vscode',
  });

  useEffect(() => {
    function watchConfigChange(e: WorkspaceConfigProps) {
      document.body.setAttribute("data-use-code-theme", `${e.themeType === "vscode"}`);

      setConfig(e);
    }

    workspaceConfig.getConfig().then(watchConfigChange);
    workspaceConfig.addListener("configChange", watchConfigChange);

    return () => {
      workspaceConfig.removeListener("configChange", watchConfigChange);
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
