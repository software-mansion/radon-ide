import { useToggleableAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

import IconButton from "../components/shared/IconButton";
import { useModal } from "../providers/ModalProvider";
import LaunchConfigurationView from "../views/LaunchConfigurationView";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { BuildType } from "../../common/Project";
import { useDependencies } from "../providers/DependenciesProvider";

type LogsButtonDestination = "build" | "extension";

function BuildErrorActions({
  logsButtonDestination,
  onReload,
}: {
  logsButtonDestination?: LogsButtonDestination;
  onReload?: () => void;
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
        }}
        tooltip={{ label: "Open build logs", side: "bottom" }}>
        <span className="codicon codicon-symbol-keyword" />
      </IconButton>
      <IconButton
        type="secondary"
        onClick={onReload}
        tooltip={{ label: "Reload IDE", side: "bottom" }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
    </>
  );
}

export function useBuildErrorAlert(shouldDisplayAlert: boolean) {
  const { projectState, project } = useProject();
  const { ios, xcodeSchemes } = useLaunchConfig();
  const { dependencies } = useDependencies();

  let onReload = () => {
    project.restart(false);
  };
  let logsButtonDestination: LogsButtonDestination | undefined = undefined;

  let description =
    projectState.status === "buildError"
      ? projectState.buildError.message
      : "Open build logs to find out what went wrong.";

  if (projectState.status !== "buildError" && dependencies.nodejs?.status === "notInstalled") {
    description =
      "Node.js was not found, or the version in the PATH does not satisfy minimum version requirements.";
    logsButtonDestination = "extension";
  } else if (projectState.status !== "buildError" && !ios?.scheme && xcodeSchemes.length > 1) {
    description = `Your project uses multiple build schemas. Currently used scheme: '${xcodeSchemes[0]}'. You can change it in the launch configuration.`;
  } else if (
    projectState.status === "buildError" &&
    projectState.buildError.buildType === BuildType.Eas
  ) {
    logsButtonDestination = "extension";
  }

  const actions = (
    <BuildErrorActions logsButtonDestination={logsButtonDestination} onReload={onReload} />
  );

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
          project.focusDebugConsole();
        }}
        tooltip={{ label: "Open debug console", side: "bottom" }}>
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
