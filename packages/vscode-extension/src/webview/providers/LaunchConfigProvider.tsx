import {
  PropsWithChildren,
  useContext,
  createContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { makeProxy } from "../utilities/rpc";
import { LaunchConfig, LaunchConfigProps } from "../../common/LaunchConfig";

const launchConfig = makeProxy<LaunchConfig>("LaunchConfig");

type LaunchConfigContextType = LaunchConfigProps & {
  update: <K extends keyof LaunchConfigProps>(key: K, value: LaunchConfigProps[K]) => void;
};

const LaunchConfigContext = createContext<LaunchConfigContextType>({ update: () => {} });

export default function LaunchConfigProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<LaunchConfigProps>({});

  useEffect(() => {
    launchConfig.getConfig().then(setConfig);
    launchConfig.addListener("launchConfigChange", setConfig);

    return () => {
      launchConfig.removeListener("launchConfigChange", setConfig);
    };
  }, []);

  const update = useCallback(
    <K extends keyof LaunchConfigProps>(key: K, value: LaunchConfigProps[K]) => {
      const newState = { ...config, [key]: value };
      setConfig(newState);
      launchConfig.update(key, value);
    },
    [config, setConfig]
  );

  return (
    <LaunchConfigContext.Provider value={{ ...config, update }}>
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
