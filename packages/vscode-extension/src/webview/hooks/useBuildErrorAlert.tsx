import { useToggleableAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

import IconButton from "../components/shared/IconButton";
import { useModal } from "../providers/ModalProvider";
import LaunchConfigurationView from "../views/LaunchConfigurationView";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { useDependencies } from "../providers/DependenciesProvider";
import { DevicePlatform } from "../../common/DeviceManager";

function BuildErrorActions({
  logsButtonDestination,
}: {
  logsButtonDestination?: "build" | "extension";
}) {
  const { project } = useProject();
  const { openModal } = useModal();
  return (
    <>
      <IconButton
        type="secondary"
        onClick={() => {
          openModal("Launch Configuration", <LaunchConfigurationView />);
        }}
        tooltip={{ label: "Launch Configuration", side: "bottom" }}>
        <span className="codicon codicon-rocket" />
      </IconButton>
      <IconButton
        type="secondary"
        onClick={() => {
          if (logsButtonDestination === "extension") {
            project.focusExtensionLogsOutput();
          } else {
            project.focusBuildOutput();
          }
          project.focusBuildOutput();
        }}
        tooltip={{ label: "Open build logs", side: "bottom" }}>
        <span className="codicon codicon-symbol-keyword" />
      </IconButton>
      <IconButton
        type="secondary"
        onClick={() => {
          project.restart(false);
        }}
        tooltip={{ label: "Reload IDE", side: "bottom" }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
    </>
  );
}

export function useBuildErrorAlert(shouldDisplayAlert: boolean) {
  const { ios, xcodeSchemes, eas } = useLaunchConfig();
  const { dependencies } = useDependencies();
  const { projectState } = useProject();

  let description = "Open build logs to find out what went wrong.";
  let actions = <BuildErrorActions />;

  if (!ios?.scheme && xcodeSchemes.length > 1) {
    description = `Your project uses multiple build schemas. Currently used scheme: '${xcodeSchemes[0]}'. You can change it in the launch configuration.`;
  }

  if (
    dependencies.android?.status === "notInstalled" &&
    projectState.selectedDevice?.platform === DevicePlatform.Android
  ) {
    description =
      'Your project does not have "android" directory. If this is an Expo project, you may need to run `expo prebuild` to generate missing files, or configure external build source using launch configuration.';
  }

  if (
    dependencies.ios?.status === "notInstalled" &&
    projectState.selectedDevice?.platform === DevicePlatform.IOS
  ) {
    description =
      'Your project does not have "ios" directory. If this is an Expo project, you may need to run `expo prebuild` to generate missing files, or configure external build source using launch configuration.';
  }

  const isEasBuild =
    (!!eas?.android && projectState.selectedDevice?.platform === DevicePlatform.Android) ||
    (!!eas?.ios && projectState.selectedDevice?.platform === DevicePlatform.IOS);

  if (isEasBuild) {
    if (dependencies.easCli?.status === "notInstalled") {
      description =
        "Your project uses EAS build, but eas-cli is not installed. Install it and reload the app.";
    } else {
      description = "Your project EAS build has failed, see extension logs to see what went wrong.";
    }
    actions = <BuildErrorActions logsButtonDestination="extension" />;
  }

  const buildErrorAlert = {
    id: "build-error-alert",
    title: "Cannot run project",
    description,
    actions,
  };

  useToggleableAlert(shouldDisplayAlert, buildErrorAlert);
}

function BootErrorActions() {
  const { project } = useProject();
  return (
    <>
      <IconButton
        type="secondary"
        onClick={() => {
          project.focusExtensionLogsOutput();
        }}
        tooltip={{ label: "Open IDE logs", side: "bottom" }}>
        <span className="codicon codicon-output" />
      </IconButton>
    </>
  );
}

export function useBootErrorAlert(shouldDisplayAlert: boolean) {
  useToggleableAlert(shouldDisplayAlert, {
    id: "boot-error-alert",
    title: "Couldn't start selected device",
    description:
      "Perhaps the device runtime is not installed or your computer has run out of space. Open IDE logs to find out what went wrong.",
    actions: <BootErrorActions />,
  });
}

function BundleErrorActions() {
  const { project } = useProject();
  return (
    <>
      <IconButton
        type="secondary"
        onClick={() => {
          project.focusExtensionLogsOutput();
        }}
        tooltip={{ label: "Open extension logs", side: "bottom" }}>
        <span className="codicon codicon-output" />
      </IconButton>
      <IconButton
        type="secondary"
        onClick={() => {
          project.restart(false);
        }}
        tooltip={{ label: "Reload Metro", side: "bottom" }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
    </>
  );
}

const bundleErrorAlert = {
  id: "bundle-error-alert",
  title: "Bundle error",
  description: "Open IDE logs to find out what went wrong.",
  actions: <BundleErrorActions />,
};

export function useBundleErrorAlert(shouldDisplayAlert: boolean) {
  useToggleableAlert(shouldDisplayAlert, bundleErrorAlert);
}
