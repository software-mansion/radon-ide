import { useToggleableAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

import IconButton from "../components/shared/IconButton";
import { useModal } from "../providers/ModalProvider";
import LaunchConfigurationView from "../views/LaunchConfigurationView";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { useDependencies } from "../providers/DependenciesProvider";
import { DevicePlatform } from "../../common/DeviceManager";

function BuildErrorActions() {
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
  const { ios, xcodeSchemes } = useLaunchConfig();
  const { dependencies } = useDependencies();
  const { projectState } = useProject();

  let description = "Open build logs to find out what went wrong.";

  if (!ios?.scheme && xcodeSchemes.length > 1) {
    description = `Your project uses multiple build schemas. Currently used scheme: '${xcodeSchemes[0]}'. You can change it in the launch configuration.`;
  }

  if (
    dependencies.android?.status === "notInstalled" &&
    projectState.selectedDevice?.platform === DevicePlatform.Android
  ) {
    description =
      "Your project does not have an android directory, configure custom build source, eas or use expo prebuild to generate missing files.";
  }

  if (
    dependencies.ios?.status === "notInstalled" &&
    projectState.selectedDevice?.platform === DevicePlatform.IOS
  ) {
    description =
      "Your project does not have an ios directory, configure custom build source, eas or use expo prebuild to generate missing files.";
  }

  const buildErrorAlert = {
    id: "build-error-alert",
    title: "Cannot run project",
    description,
    actions: <BuildErrorActions />,
  };

  useToggleableAlert(shouldDisplayAlert, buildErrorAlert);
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
