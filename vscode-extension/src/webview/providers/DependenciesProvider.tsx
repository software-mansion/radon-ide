import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";

export interface DependencyData {
  installed?: boolean;
  info?: string;
  error?: string;
}
interface Dependencies {
  Nodejs?: DependencyData;
  AndroidStudio?: DependencyData;
  Xcode?: DependencyData;
  CocoaPods?: DependencyData;
  NodeModules?: DependencyData;
  Pods?: DependencyData;
}

const defaultDependencies: Dependencies = {
  Nodejs: undefined,
  AndroidStudio: undefined,
  Xcode: undefined,
  CocoaPods: undefined,
  NodeModules: undefined,
  Pods: undefined,
};

const prerequisites = Object.keys(defaultDependencies);

function runDiagnostics() {
  prerequisites.forEach((prerequisite) => {
    vscode.postMessage({
      command: `check${prerequisite}Installed`,
    });
  });
}

interface DependenciesContextProps {
  dependencies: Dependencies;
  isReady: boolean;
  runDiagnostics: () => void;
}

const DependenciesContext = createContext<DependenciesContextProps>({
  dependencies: defaultDependencies,
  isReady: false,
  runDiagnostics,
});

interface DependenciesProviderProps {
  children: React.ReactNode;
}

export default function DependenciesProvider({ children }: DependenciesProviderProps) {
  const [dependencies, setDependencies] = useState<Dependencies>({});

  // `isReady` is true when all dependencies were checked
  const isReady = Object.keys(dependencies).every(
    (key) => dependencies[key as keyof Dependencies] !== undefined
  );

  const rerunDiagnostics = useCallback(() => {
    // set `.installed` and .error to undefined, leave other data as is
    setDependencies((prevState) => {
      const newState: Dependencies = {};
      Object.keys(prevState).forEach((key) => {
        const typedKey = key as keyof Dependencies;
        newState[typedKey] = {
          ...prevState[typedKey],
          installed: undefined,
          error: undefined,
        };
      });
      return newState;
    });
    runDiagnostics();
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent<any>) => {
      const message = event.data;
      switch (message.command) {
        case "isNodejsInstalled":
          setDependencies((prev) => ({ ...prev, Nodejs: message.data }));
          break;
        case "isAndroidStudioInstalled":
          setDependencies((prev) => ({ ...prev, AndroidStudio: message.data }));
          break;
        case "isXcodeInstalled":
          setDependencies((prev) => ({ ...prev, Xcode: message.data }));
          break;
        case "isCocoaPodsInstalled":
          setDependencies((prev) => ({ ...prev, CocoaPods: message.data }));
          break;
        case "isNodeModulesInstalled":
          setDependencies((prev) => ({ ...prev, NodeModules: message.data }));
          break;
        case "installingNodeModules":
          setDependencies((prev) => ({
            ...prev,
            NodeModules: { ...prev.NodeModules, error: undefined, installed: undefined },
          }));
          break;
        case "isPodsInstalled":
          setDependencies((prev) => ({ ...prev, Pods: message.data }));
          break;
        case "installingPods":
          setDependencies((prev) => ({
            ...prev,
            Pods: { ...prev.Pods, error: undefined, installed: undefined },
          }));
          break;
      }
    };

    runDiagnostics();

    window.addEventListener("message", listener);

    return () => window.removeEventListener("message", listener);
  }, []);

  return (
    <DependenciesContext.Provider
      value={{ dependencies, isReady, runDiagnostics: rerunDiagnostics }}>
      {children}
    </DependenciesContext.Provider>
  );
}

export function useDependencies() {
  const context = useContext(DependenciesContext);

  if (context === undefined) {
    throw new Error("useDependencies must be used within a DependenciesProvider");
  }

  return context;
}
