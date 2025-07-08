import { PropsWithChildren, useContext, createContext, useState, useEffect, useMemo } from "react";
import { makeProxy } from "../utilities/rpc";
import {
  ApplicationRoot,
  AppRootConfig as AppRootConfigInterface,
} from "../../common/AppRootConfig";
import { EasBuildConfig } from "../../common/EasConfig";

const appRootConfigProxy = makeProxy<AppRootConfigInterface>("AppRootConfig");

export interface AppRootConfig {
  xcodeSchemes: string[];
  easBuildProfiles: EasBuildConfig;
}

export function useAppRootConfig(appRootFolder: string | undefined): AppRootConfig {
  const [xcodeSchemes, setXcodeSchemes] = useState<string[]>([]);
  const [easBuildProfiles, setEasBuildProfiles] = useState<EasBuildConfig>({});

  useEffect(() => {
    if (appRootFolder === undefined) {
      setXcodeSchemes([]);
      setEasBuildProfiles({});
      return;
    }
    appRootConfigProxy.getAvailableEasProfiles(appRootFolder).then(setEasBuildProfiles);
    appRootConfigProxy.getAvailableXcodeSchemes(appRootFolder).then(setXcodeSchemes);
  }, [appRootFolder]);

  return useMemo(
    () => ({
      xcodeSchemes,
      easBuildProfiles,
    }),
    [xcodeSchemes, easBuildProfiles]
  );
}

const ApplicationRootsContext = createContext<ApplicationRoot[]>([]);

export default function ApplicationRootsProvider({ children }: PropsWithChildren) {
  const [applicationRoots, setApplicationRoots] = useState<ApplicationRoot[]>([]);

  useEffect(() => {
    appRootConfigProxy.getAvailableApplicationRoots().then(setApplicationRoots);
  }, []);

  return (
    <ApplicationRootsContext.Provider value={applicationRoots}>
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
