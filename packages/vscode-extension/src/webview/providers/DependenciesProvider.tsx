import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { vscode } from "../utilities/vscode";
import { makeProxy } from "../utilities/rpc";
import { DependencyManager } from "../../common/DependencyManager";
import { Platform } from "../providers/UtilsProvider";

const dependencyManager = makeProxy<DependencyManager>("DependencyManager");

export enum InstallationStatus {
  NotInstalled,
  InProgress,
  Installed,
  Optional,
}

export interface DependencyState {
  installed: InstallationStatus;
  info: string;
  error?: string;
  isOptional?: boolean;
}

interface DependencyMessageData {
  command: string;
  data: {
    installed: boolean;
    info: string;
    error?: string;
    isOptional?: boolean;
  };
}

// when editing, update hasError function
type Dependencies = {
  Nodejs?: DependencyState;
  AndroidEmulator?: DependencyState;
  Xcode?: DependencyState;
  CocoaPods?: DependencyState;
  NodeModules?: DependencyState;
  ReactNative?: DependencyState;
  Expo?: DependencyState;
  Pods?: DependencyState;
  ExpoRouter?: DependencyState;
  Storybook?: DependencyState;
};

const prerequisites = [
  "Nodejs",
  "AndroidEmulator",
  "Xcode",
  "CocoaPods",
  "NodeModules",
  "ReactNative",
  "Expo",
  "Pods",
  "ExpoRouter",
  "Storybook",
] as const;

const prerequisitesProxy = [
  "nodejs",
  "androidEmulator",
  "xcode",
  "cocoaPods",
  "nodeModules",
  "reactNative",
  "expo",
  "pods",
  "expoRouter",
  "storybook",
] as const;

const defaultDependencies = Object.fromEntries(
  prerequisites.map((prerequisite) => [prerequisite, undefined])
) as Record<typeof prerequisites[number], DependencyState | undefined>;

function hasError(dependencies: Dependencies, domain: "ios" | "android" | "common"): boolean {
  function errored(state: DependencyState | undefined) {
    if (state === undefined) {
      return false;
    }
    return state.error !== undefined;
  }

  const required = {
    ios: ["Xcode", "CocoaPods", "Pods"],
    android: ["AndroidEmulator"],
    common: ["Nodejs", "NodeModules"],
  }[domain];

  return entries(dependencies)
    .filter(([dependency, _state]) => required.includes(dependency))
    .some(([_dependency, state]) => errored(state));
}

function adaptDependencyData(data: DependencyMessageData["data"]): DependencyState {
  const installationStatus = data.installed
    ? InstallationStatus.Installed
    : InstallationStatus.NotInstalled;

  return {
    ...data,
    installed: installationStatus,
    error: data.isOptional ? undefined : data.error,
    isOptional: data.isOptional ?? false,
  };
}

function entries<K extends string, T>(object: Partial<Record<K, T>>) {
  return Object.entries(object) as [K, T][];
}

interface DependenciesContextProps {
  dependencies: Dependencies;
  isReady: boolean;
  isCommonError: boolean;
  isAndroidError: boolean;
  isIosError: boolean;
  androidEmulatorError: string | undefined;
  iosSimulatorError: string | undefined;
  runDiagnostics: () => void;
  isExpoRouterInstalled: boolean;
  isStorybookInstalled: boolean;
}

const DependenciesContext = createContext<DependenciesContextProps>({
  dependencies: defaultDependencies,
  isReady: false,
  isCommonError: false,
  isAndroidError: false,
  isIosError: false,
  androidEmulatorError: undefined,
  iosSimulatorError: undefined,
  runDiagnostics: () => {
    throw new Error("Provider not initialized");
  },
  isExpoRouterInstalled: false,
  isStorybookInstalled: false,
});

async function runDiagnosticsProxy() {
  function availableOnPlatform(prerequisite: typeof prerequisitesProxy[number]) {
    const macosOnly = ["xcode", "cocoaPods", "pods"].includes(prerequisite);

    if (macosOnly) {
      return Platform.OS === "macos";
    }
    return true;
  }
  console.log("XD: before Promise.all", prerequisitesProxy.filter(availableOnPlatform));

  try {
    const statuses = await Promise.all(
      prerequisitesProxy
        .filter(availableOnPlatform)
        .map((prerequisite) => dependencyManager.getDependencyStatus(prerequisite))
    );

    console.log("XD: after Promise.all", statuses);

    return Object.fromEntries(
      prerequisites.map((prerequisite, i) => [prerequisite, adaptDependencyData(statuses[i])])
    ) as Record<typeof prerequisites[number], DependencyState>;
  } catch (error) {
    console.log("XD: error", error);
  }
}

export default function DependenciesProvider({ children }: PropsWithChildren) {
  const [dependencies, setDependencies] = useState<Dependencies>({});

  // `isReady` is true when all dependencies were checked
  const isReady = !Object.values<DependencyState | undefined>(dependencies).includes(undefined);
  const isExpoRouterInstalled = false;
  const isStorybookInstalled = false;

  const isCommonError = hasError(dependencies, "common");
  const isIosError = hasError(dependencies, "ios");
  const isAndroidError = hasError(dependencies, "android");

  const androidEmulatorError = dependencies.AndroidEmulator?.error;
  const iosSimulatorError = dependencies.Xcode?.error;

  const rerunDiagnostics = useCallback(async () => {
    // reset `.installed` and .error, leave other data as is
    setDependencies((prevState) => {
      const newState: Dependencies = {};
      for (const [dependency, data] of entries(prevState)) {
        newState[dependency] = {
          ...data,
          installed: InstallationStatus.NotInstalled,
          error: undefined,
        };
      }
      return newState;
    });

    const diagnostics = await runDiagnosticsProxy();
    console.log({ diagnostics });
    for (const [dependency, status] of Object.entries(diagnostics)) {
      updateDependency(dependency as typeof prerequisites[number], status);
    }
  }, []);

  const updateDependency = useCallback(
    (name: keyof Dependencies, newState: Partial<DependencyState>) => {
      if (newState.isOptional && newState.installed === InstallationStatus.NotInstalled) {
        newState.installed = InstallationStatus.Optional;
      }

      setDependencies((prev) => ({
        ...prev,
        [name]: { ...prev[name], ...newState },
      }));
    },
    [setDependencies]
  );

  useEffect(() => {
    const listener = (event: MessageEvent<DependencyMessageData>) => {
      const { command, data: rawData } = event.data;
      if (!rawData) {
        return;
      }
      const data = adaptDependencyData(rawData);
      switch (command) {
        case "isNodeModulesInstalled":
          updateDependency("NodeModules", data);
          break;
        case "installingNodeModules":
          updateDependency("NodeModules", { installed: InstallationStatus.InProgress });
          break;
        case "isPodsInstalled":
          updateDependency("Pods", data);
          break;
        case "installingPods":
          updateDependency("Pods", { error: undefined, installed: InstallationStatus.InProgress });
          break;
      }
    };

    runDiagnosticsProxy().then((diagnostics) => {
      console.log({ diagnosticsInitial: diagnostics });
      for (const [dependency, status] of Object.entries(diagnostics)) {
        updateDependency(dependency as typeof prerequisites[number], status);
      }
    });

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  return (
    <DependenciesContext.Provider
      value={{
        dependencies,
        isReady,
        isCommonError,
        isAndroidError,
        isIosError,
        androidEmulatorError,
        iosSimulatorError,
        runDiagnostics: rerunDiagnostics,
        isExpoRouterInstalled,
        isStorybookInstalled,
      }}>
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
