import {
  PropsWithChildren,
  useContext,
  createContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { makeProxy } from "../utilities/rpc";
import {
  LaunchConfig,
  LaunchConfigUpdater,
  LaunchConfigurationOptions,
} from "../../common/LaunchConfig";

const launchConfig = makeProxy<LaunchConfig>("LaunchConfig");

type LaunchConfigContextType = LaunchConfigurationOptions & {
  update: LaunchConfigUpdater;
  xcodeSchemes: string[];
};

const LaunchConfigContext = createContext<LaunchConfigContextType>({
  update: () => {},
  xcodeSchemes: [],
});

export default function LaunchConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<LaunchConfigurationOptions>({});
  const [xcodeSchemes, setXcodeSchemes] = useState<string[]>([]);

  useEffect(() => {
    launchConfig.getConfig().then(setConfig);
    launchConfig.addListener("launchConfigChange", setConfig);

    launchConfig.getAvailableXcodeSchemes().then(setXcodeSchemes);

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

  return (
    <LaunchConfigContext.Provider value={{ ...config, update, xcodeSchemes }}>
      {children}
    </LaunchConfigContext.Provider>
  );
}

export function useLaunchConfig() {
  const context = useContext(LaunchConfigContext);

  if (context === undefined) {
    throw new Error("useLaunchConfig must be used within a LaunchConfigProvider");
  }
  return context;
}
