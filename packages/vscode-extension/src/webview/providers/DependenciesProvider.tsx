import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { makeProxy } from "../utilities/rpc";
import {
  DependencyManagerInterface,
  DependencyStatus,
  MinSupportedVersion,
} from "../../common/DependencyManager";

const dependencyManager = makeProxy<DependencyManagerInterface>("DependencyManager");

const dependenciesDomain = [
  "nodejs",
  "packageManager",
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

type Dependency = typeof dependenciesDomain[number];

type ErrorType = "ios" | "simulator" | "emulator" | "android" | "common";
type Errors = Partial<Record<ErrorType, { message: string }>>;
type DependencyRecord = Partial<Record<Dependency, DependencyStatus>>;

interface DependenciesContextProps {
  dependencies: DependencyRecord;
  errors: Errors | undefined;
  runDiagnostics: () => Promise<void>;
}

const DependenciesContext = createContext<DependenciesContextProps>({
  dependencies: {},
  errors: undefined,
  runDiagnostics: () => {
    throw new Error("Provider not initialized");
  },
});

export default function DependenciesProvider({ children }: PropsWithChildren) {
  const [depsState, updateDepsState] = useState<DependencyRecord>({});

  const runDiagnostics = useCallback(() => {
    return dependencyManager.runAllDependencyChecks();
  }, []);

  useEffect(() => {
    const dependencies: DependencyRecord = {};

    function handleUpdatedDependency(dependency: Dependency, status: DependencyStatus) {
      dependencies[dependency] = status;
      updateDepsState({ ...dependencies });
    }

    dependencyManager.addListener(handleUpdatedDependency);
    runDiagnostics();

    return () => {
      dependencyManager.removeListener(handleUpdatedDependency);
    };
  }, []);

  const contextValue = useMemo(() => {
    return {
      dependencies: depsState,
      runDiagnostics,
      errors: getErrors(depsState),
    };
  }, [depsState, runDiagnostics, getErrors]);

  return (
    <DependenciesContext.Provider value={contextValue}>{children}</DependenciesContext.Provider>
  );
}

export function useDependencies() {
  const context = useContext(DependenciesContext);

  if (context === undefined) {
    throw new Error("useDependencies must be used within a DependenciesProvider");
  }

  return context;
}

function getErrors(statuses: DependencyRecord) {
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
        case "packageManager":
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

export function dependencyDescription(dependency: Dependency) {
  switch (dependency) {
    case "nodejs":
      return {
        info: "Used for running scripts and getting dependencies.",
        error: "Node.js was not found. Make sure to [install Node.js](https://nodejs.org/en).",
      };
    case "packageManager":
      return {
        info: "Used for managing project dependencies and scripts.",
        error:
          "Package manager not found or uninstalled. Make sure to install the package manager used in the project.",
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
        info: 'Whether "ios" directory exists in the project',
        error: '"ios" directory does not exist in the main application directory',
      };
    case "android":
      return {
        info: 'Whether "android" directory exists in the project',
        error: '"android" directory does not exist in the main application directory',
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
