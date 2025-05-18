import { PropsWithChildren, useContext, useState, useEffect, useMemo, createContext } from "react";
import { makeProxy } from "../utilities/rpc";
import { ProjectInterface, ProjectState } from "../../common/Project";

const project = makeProxy<ProjectInterface>("Project");

interface ProjectContextProps {
  projectState: ProjectState;
  project: ProjectInterface;
  hasActiveLicense: boolean;
}

const defaultProjectState: ProjectState = {
  selectedDevice: undefined,
  previewZoom: "Fit",
  initialized: false,
};

const ProjectContext = createContext<ProjectContextProps>({
  projectState: defaultProjectState,
  project,
  hasActiveLicense: false,
});

export default function ProjectProvider({ children }: PropsWithChildren) {
  const [projectState, setProjectState] = useState<ProjectState>(defaultProjectState);
  const [hasActiveLicense, setHasActiveLicense] = useState(true);

  useEffect(() => {
    project.getProjectState().then(setProjectState);
    project.addListener("projectStateChanged", setProjectState);

    project.hasActiveLicense().then(setHasActiveLicense);
    project.addListener("licenseActivationChanged", setHasActiveLicense);
    return () => {
      project.removeListener("projectStateChanged", setProjectState);
      project.removeListener("licenseActivationChanged", setHasActiveLicense);
    };
  }, []);

  const contextValue = useMemo(() => {
    return {
      projectState,
      project,
      hasActiveLicense,
    };
  }, [projectState, project, hasActiveLicense]);

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
