import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { makeProxy } from "../utilities/rpc";
import {
  DependencyManagerInterface,
  DependencyStatus,
  InstallationStatus,
  MinSupportedVersion,
} from "../../common/DependencyManager";
import { Platform } from "../providers/UtilsProvider";

const dependencyManager = makeProxy<DependencyManagerInterface>("DependencyManager");

const dependencies = [
  "nodejs",
  "androidEmulator",
  "xcode",
  "cocoaPods",
  "nodeModules",
  "ios",
  "android",
  "pods",
  "reactNative",
  "expo",
  "expoRouter",
  "storybook",
] as const;

type Dependency = typeof dependencies[number];

type ErrorType = "ios" | "simulator" | "emulator" | "android" | "common";
type Errors = Partial<Record<ErrorType, { message: string }>>;

interface DependenciesContextProps {
  dependencies: Record<Dependency, DependencyStatus | undefined>;
  errors: Errors | undefined;
  runDiagnostics: () => Promise<void>;
}

const DependenciesContext = createContext<DependenciesContextProps>({
  dependencies: objectFromKeys<Dependency, DependencyStatus | undefined>(dependencies, undefined),
  errors: undefined,
  runDiagnostics: () => {
    throw new Error("Provider not initialized");
  },
});

export default function DependenciesProvider({ children }: PropsWithChildren) {
  const [dependencyState, updateDependencies] = useObjectState<Dependency, DependencyStatus>(
    dependencies
  );

  const runDiagnostics = useCallback(async () => {
    const checkableDependencies = dependencies.filter(availableOnPlatform);
    const diagnostics = await dependencyManager.getStatus(checkableDependencies);

    updateDependencies(diagnostics);
  }, []);

  useEffect(() => {
    function handleUpdatedDependency(
      dependency: Dependency,
      installationStatus: InstallationStatus
    ) {
      updateDependencies((prev) => {
        const previousState = prev[dependency];
        if (!previousState) {
          throw new Error(`Dependency ${dependency} updated before it was initialized`);
        }

        return { [dependency]: { ...previousState, status: installationStatus } };
      });
    }

    runDiagnostics();

    dependencyManager.addListener(handleUpdatedDependency);
    return () => {
      dependencyManager.removeListener(handleUpdatedDependency);
    };
  }, []);

  return (
    <DependenciesContext.Provider
      value={{
        dependencies: dependencyState,
        runDiagnostics,
        errors: getErrors(dependencyState),
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

function objectFromKeys<K extends string, V>(keys: readonly K[], defaultValue: V): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, defaultValue])) as Record<K, V>;
}

function useObjectState<K extends string, V>(keys: readonly K[]) {
  const [state, setState] = useState(() => objectFromKeys<K, V | undefined>(keys, undefined));

  function update(
    objectOrUpdater:
      | Partial<Record<K, V>>
      | ((prev: Record<K, V | undefined>) => Partial<Record<K, V>>)
  ): void {
    const isUpdater = typeof objectOrUpdater === "function";
    if (isUpdater) {
      const updater = objectOrUpdater;
      setState((prev) => ({ ...prev, ...updater(prev) }));
    } else {
      const object = objectOrUpdater;
      setState((prev) => ({ ...prev, ...object }));
    }
  }

  return [state, update] as const;
}

function getErrors(statuses: Record<Dependency, DependencyStatus | undefined>) {
  const errors: Errors = {};
  let hasErrors = false;
  function setFirstError(dependency: Dependency, errorName: ErrorType) {
    hasErrors = true;
    if (!errors[errorName]) {
      const message = dependencyDescription(dependency).error;
      errors[errorName] = { message };
    }
  }

  Object.entries(statuses)
    .filter(([_dependency, info]) => {
      const notInstalled = info !== undefined && !info.isOptional && info.status === "notInstalled";
      return notInstalled;
    })
    .forEach(([dependency, _info]) => {
      switch (dependency) {
        case "xcode":
          setFirstError(dependency, "emulator");
        /* fallthrough */
        case "cocoaPods":
        case "pods":
          setFirstError(dependency, "ios");
          break;
        case "androidEmulator":
          setFirstError(dependency, "android");
          setFirstError(dependency, "emulator");
          break;
        case "nodejs":
        case "nodeModules":
          setFirstError(dependency, "common");
          break;
        case "ios":
          setFirstError(dependency, "ios");
        case "android":
          setFirstError(dependency, "android");
        default:
          break;
      }
    });
  return hasErrors ? errors : undefined;
}

function availableOnPlatform(dependency: Dependency) {
  const macosOnly = ["xcode", "cocoaPods", "pods"].includes(dependency);

  if (macosOnly) {
    return Platform.OS === "macos";
  }
  return true;
}

export function dependencyDescription(dependency: Dependency) {
  switch (dependency) {
    case "nodejs":
      return {
        info: "Used for running scripts and getting dependencies.",
        error: "Node.js was not found. Make sure to [install Node.js](https://nodejs.org/en).",
      };
    case "androidEmulator":
      return {
        info: "Used for running Android apps.",
        error:
          "Android Emulator was not found. Make sure to [install Android Emulator](https://developer.android.com/studio/run/managing-avds).",
      };
    case "xcode":
      return {
        info: "Used for building and running iOS apps.",
        error:
          "Xcode was not found. If you are using alternative Xcode version you can find out more in troubleshooting section of our documentation. Otherwise, [Install Xcode from the Mac App Store](https://apps.apple.com/us/app/xcode/id497799835?mt=12) and have Xcode Command Line Tools enabled.",
      };
    case "cocoaPods":
      return {
        info: "Used for installing iOS dependencies.",
        error:
          "CocoaPods was not found. Make sure to [install CocoaPods](https://guides.cocoapods.org/using/getting-started.html).",
      };
    case "nodeModules":
      return {
        info: "Whether node modules are installed",
        error: "Node modules are not installed.",
      };
    case "pods":
      return { info: "Whether iOS dependencies are installed.", error: "Pods are not installed." };
    case "reactNative":
      return {
        info: "Whether supported version of React Native is installed.",
        error: `React Native is not installed or it is older than supported version ${MinSupportedVersion.reactNative}.`,
      };
    case "ios":
      return {
        info: "Whether ios directory exists in the project",
        error: "Ios directory does not exist in root directory",
      };
    case "android":
      return {
        info: "Whether android directory exists in the project",
        error: "Android directory does not exist in root directory",
      };
    case "expo":
      return {
        info: "Whether supported version of Expo SDK is installed.",
        error: `Expo is not installed or it is older than supported version ${MinSupportedVersion.expo}.`,
      };
    case "expoRouter":
      return {
        info: "Whether supported version of Expo Router is installed.",
        error: `expo-router is not installed.`,
      };
    case "storybook":
      return {
        info: "Whether Storybook is installed.",
        error: "Storybook is not installed.",
      };
  }
}
