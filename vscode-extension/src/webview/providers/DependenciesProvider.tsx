import { createContext, useContext, useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";

interface DependenciesContextProps {
  dependencies: any;
  isLoading: boolean;
  isReady: boolean;
  // deprecated
  iosDepsInstalling: boolean;
  // deprecated
  setIosDepsInstalling: React.Dispatch<boolean>;
}

const DependenciesContext = createContext<DependenciesContextProps>({
  dependencies: null,
  isLoading: false,
  isReady: false,
  iosDepsInstalling: false,
  setIosDepsInstalling: () => {},
});

interface DependenciesProviderProps {
  children: React.ReactNode;
}

function checkIfAllDependenciesInstalled(dependencies: any) {
  return Object.values(dependencies).every((installed) => installed);
}

export default function DependenciesProvider({ children }: DependenciesProviderProps) {
  const [dependencies, setDependencies] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [iosDepsInstalling, setIosDepsInstalling] = useState(false);

  useEffect(() => {
    const listener = (event: MessageEvent<any>) => {
      const message = event.data;
      switch (message.command) {
        case "checkedDependencies":
          setDependencies(message.dependencies);
          setIsLoading(false);
          setIsReady(checkIfAllDependenciesInstalled(message.dependencies));
          break;
        case "installationComplete":
          setIosDepsInstalling(false);
          break;
      }
    };

    window.addEventListener("message", listener);

    vscode.postMessage({
      command: "handlePrerequisites",
    });

    return () => window.removeEventListener("message", listener);
  }, []);

  return (
    <DependenciesContext.Provider
      value={{ dependencies, isLoading, isReady, iosDepsInstalling, setIosDepsInstalling }}>
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
