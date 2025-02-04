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
  EasConfig,
  LaunchConfig,
  LaunchConfigUpdater,
  LaunchConfigurationOptions,
} from "../../common/LaunchConfig";

const launchConfig = makeProxy<LaunchConfig>("LaunchConfig");

type LaunchConfigContextType = LaunchConfigurationOptions & {
  update: LaunchConfigUpdater;
  xcodeSchemes: string[];
  easBuildProfiles: string[];
  eas?: {
    ios?: EasConfig;
    android?: EasConfig;
  };
};

const LaunchConfigContext = createContext<LaunchConfigContextType>({
  update: () => {},
  xcodeSchemes: [],
  easBuildProfiles: [],
});

export default function LaunchConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<LaunchConfigurationOptions>({});
  const [xcodeSchemes, setXcodeSchemes] = useState<string[]>([]);
  const [easBuildProfiles, setEasBuildProfiles] = useState<string[]>([]);

  useEffect(() => {
    launchConfig.getConfig().then(setConfig);
    launchConfig.addListener("launchConfigChange", setConfig);

    launchConfig.getAvailableXcodeSchemes().then(setXcodeSchemes);
    launchConfig.getAvailableEasProfiles().then(setEasBuildProfiles);

    return () => {
      launchConfig.removeListener("launchConfigChange", setConfig);
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

  const contextValue = useMemo(() => {
    return { ...config, update, xcodeSchemes, easBuildProfiles };
  }, [config, update, xcodeSchemes, easBuildProfiles]);

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
