import { use$ } from "@legendapp/state/react";
import { useMemo } from "react";
import { useStore } from "../providers/storeProvider";
import {
  ApplicationDependency,
  ApplicationDependencyStatuses,
  EnvironmentDependency,
  EnvironmentDependencyStatuses,
} from "../../common/State";
import { MinSupportedVersion } from "../../common/Constants";

type Errors = Partial<Record<ErrorType, { message: string }>>;
type ErrorType = "ios" | "simulator" | "emulator" | "android" | "common";
type Dependency = ApplicationDependency | EnvironmentDependency;
type DependencyStatuses = ApplicationDependencyStatuses | EnvironmentDependencyStatuses;

export const useDependencyErrors = () => {
  const store$ = useStore();
  const environmentDependencies = use$(store$.environmentDependencies);
  const applicationDependencies = use$(
    store$.projectState.applicationContext.applicationDependencies
  );
  const statuses = useMemo(() => {
    return { ...environmentDependencies, ...applicationDependencies };
  }, [environmentDependencies, applicationDependencies]);

  return getErrors(statuses);
};

function getErrors(statuses: DependencyStatuses): Errors | undefined {
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
          setFirstError(dependency, "simulator");
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
        case "nodeVersion":
        case "packageManager":
        case "nodeModules":
          setFirstError(dependency, "common");
          break;
        case "ios":
          setFirstError(dependency, "ios");
          break;
        case "android":
          setFirstError(dependency, "android");
          break;
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
        error:
          "Node.js was not found, or the version in the PATH does not satisfy minimum version requirements. You can find more information in our [documentation](https://ide.swmansion.com/docs/guides/troubleshooting#13-node-version-is-not-supported).",
      };
    case "nodeVersion":
      return {
        info: "Used for running scripts and getting dependencies.",
        error:
          "Node.js version is not supported. You can find more information in our [documentation](https://ide.swmansion.com/docs/guides/troubleshooting#13-node-version-is-not-supported).",
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
    case "easCli":
      return {
        info: "Whether eas-cli is installed.",
        error: "eas-cli is not installed.",
      };
  }
}
