import { PropsWithChildren, useContext, createContext, useState, useEffect } from "react";
import { makeProxy } from "../utilities/rpc";
import { WorkspaceConfigInterface, WorkspaceConfigProps } from "../../common/WorkspaceConfig";

const config = makeProxy<WorkspaceConfigInterface>("WorkspaceConfig");

const WorkspaceConfigContext = createContext<WorkspaceConfigProps>({
  showPanelInActivityBar: false,
  relativeAppLocation: "",
});

export default function WorkspaceConfigProvider({ children }: PropsWithChildren) {
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfigProps>({
    showPanelInActivityBar: false,
    relativeAppLocation: "",
  });

  useEffect(() => {
    config.getWorkspaceConfigProps().then(setWorkspaceConfig);
    config.addListener("workspaceConfigChange", setWorkspaceConfig);

    return () => {
      config.removeListener("workspaceConfigChange", setWorkspaceConfig);
    };
  }, []);

  return (
    <WorkspaceConfigContext.Provider value={workspaceConfig}>
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
