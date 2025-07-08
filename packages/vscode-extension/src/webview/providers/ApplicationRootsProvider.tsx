import { PropsWithChildren, useContext, createContext, useState, useEffect, useMemo } from "react";
import { makeProxy } from "../utilities/rpc";
import {
  AddCustomApplicationRoot,
  ApplicationRoot,
  AppRootConfig as AppRootConfigInterface,
} from "../../common/AppRootConfig";
import { EasBuildConfig } from "../../common/EasConfig";

const appRootConfigProxy = makeProxy<AppRootConfigInterface>("LaunchConfig");

export interface AppRootConfig {
  xcodeSchemes: string[];
  easBuildProfiles: EasBuildConfig;
}

export function useAppRootConfig(appRootFolder?: string): AppRootConfig {
  const [xcodeSchemes, setXcodeSchemes] = useState<string[]>([]);
  const [easBuildProfiles, setEasBuildProfiles] = useState<EasBuildConfig>({});

  useEffect(() => {
    appRootConfigProxy.getAvailableEasProfiles(appRootFolder).then(setEasBuildProfiles);
    appRootConfigProxy.getAvailableXcodeSchemes(appRootFolder).then(setXcodeSchemes);
  }, []);

  return useMemo(
    () => ({
      xcodeSchemes,
      easBuildProfiles,
    }),
    [xcodeSchemes, easBuildProfiles]
  );
}

export interface ApplicationRootsContextType {
  applicationRoots: ApplicationRoot[];
  addCustomApplicationRoot: AddCustomApplicationRoot;
}

const ApplicationRootsContext = createContext<ApplicationRootsContextType>({
  applicationRoots: [],
  addCustomApplicationRoot: () => Promise.resolve([]),
});

export default function ApplicationRootsProvider({ children }: PropsWithChildren) {
  const [applicationRoots, setApplicationRoots] = useState<ApplicationRoot[]>([]);

  useEffect(() => {
    appRootConfigProxy.getAvailableApplicationRoots().then(setApplicationRoots);
  }, []);

  const addCustomApplicationRoot = (appRoot: string) => {
    appRootConfigProxy.addCustomApplicationRoot(appRoot).then(setApplicationRoots);
  };

  const contextValue = useMemo(() => {
    return {
      applicationRoots,
      addCustomApplicationRoot,
    };
  }, [applicationRoots, addCustomApplicationRoot]);

  return (
    <ApplicationRootsContext.Provider value={contextValue}>
      {children}
    </ApplicationRootsContext.Provider>
  );
}

export function useApplicationRoots() {
  const context = useContext(ApplicationRootsContext);

  if (context === undefined) {
    throw new Error("useLaunchConfig must be used within a LaunchConfigProvider");
  }
  return context;
}
