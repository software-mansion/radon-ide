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
import {
  AddCustomApplicationRoot,
  EasConfig,
  LaunchConfig,
  LaunchConfigUpdater,
  LaunchConfigurationOptions,
} from "../../common/LaunchConfig";
import { EasBuildConfig } from "../../common/EasConfig";

const launchConfig = makeProxy<LaunchConfig>("LaunchConfig");

type LaunchConfigContextType = LaunchConfigurationOptions & {
  update: LaunchConfigUpdater;
  xcodeSchemes: string[];
  applicationRoots: string[];
  addCustomApplicationRoot: AddCustomApplicationRoot;
  easBuildProfiles: EasBuildConfig;
  eas?: {
    ios?: EasConfig;
    android?: EasConfig;
  };
};

const LaunchConfigContext = createContext<LaunchConfigContextType>({
  update: () => {},
  xcodeSchemes: [],
  applicationRoots: [],
  addCustomApplicationRoot: () => {},
  easBuildProfiles: {},
});

export default function LaunchConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<LaunchConfigurationOptions>({});
  const [xcodeSchemes, setXcodeSchemes] = useState<string[]>([]);
  const [applicationRoots, setApplicationRoots] = useState<string[]>([]);
  const [easBuildProfiles, setEasBuildProfiles] = useState<EasBuildConfig>({});

  useEffect(() => {
    launchConfig.getConfig().then(setConfig);
    launchConfig.addListener("launchConfigChange", setConfig);

    launchConfig.getAvailableXcodeSchemes().then(setXcodeSchemes);

    const updateApplicationRoots = () => {
      launchConfig.getAvailableApplicationRoots().then(setApplicationRoots);
    };
    updateApplicationRoots();
    launchConfig.addListener("applicationRootsChanged", updateApplicationRoots);
    launchConfig.getAvailableEasProfiles().then(setEasBuildProfiles);

    return () => {
      launchConfig.removeListener("launchConfigChange", setConfig);
      launchConfig.removeListener("applicationRootsChanged", updateApplicationRoots);
    };
  }, []);

  const update = useCallback(
    <K extends keyof LaunchConfigurationOptions>(
      key: K,
      value: LaunchConfigurationOptions[K] | "Auto"
    ) => {
      const newState = { ...config, [key]: value };
      setConfig(newState);
      launchConfig.update(key, value);
    },
    [config, setConfig]
  );

  const addCustomApplicationRoot = (appRoot: string) => {
    const newState = [...applicationRoots, appRoot];
    setApplicationRoots(newState);
    launchConfig.addCustomApplicationRoot(appRoot);
  };

  const contextValue = useMemo(() => {
    return {
      ...config,
      update,
      xcodeSchemes,
      applicationRoots,
      addCustomApplicationRoot,
      easBuildProfiles,
    };
  }, [config, update, xcodeSchemes, applicationRoots, addCustomApplicationRoot, easBuildProfiles]);

  return (
    <LaunchConfigContext.Provider value={contextValue}>{children}</LaunchConfigContext.Provider>
  );
}

export function useLaunchConfig() {
  const context = useContext(LaunchConfigContext);

  if (context === undefined) {
    throw new Error("useLaunchConfig must be used within a LaunchConfigProvider");
  }
  return context;
}
