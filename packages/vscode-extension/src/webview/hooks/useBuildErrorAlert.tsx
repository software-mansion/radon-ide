import { useToggleableAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

import IconButton from "../components/shared/IconButton";
import { useModal } from "../providers/ModalProvider";
import LaunchConfigurationView from "../views/LaunchConfigurationView";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { BuildType } from "../../common/BuildConfig";
import { useDevices } from "../providers/DevicesProvider";

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
  const { selectedDeviceSession } = useProject();
  const { ios, xcodeSchemes } = useLaunchConfig();
  const { deviceSessionsManager } = useDevices();

  let onReload = () => {
    deviceSessionsManager.reloadCurrentSession("autoReload");
  };
  let logsButtonDestination: LogsButtonDestination | undefined = undefined;

  let description = "Open extension logs to find out what went wrong.";

  if (selectedDeviceSession?.status === "buildError" && selectedDeviceSession?.buildError) {
    const { buildType, message } = selectedDeviceSession.buildError;
    description = message;
    if (buildType && [BuildType.Local, BuildType.EasLocal, BuildType.Custom].includes(buildType)) {
      logsButtonDestination = "build";
    } else {
      logsButtonDestination = "extension";
    }

    if (buildType === null && !ios?.scheme && xcodeSchemes.length > 1) {
      description = `Your project uses multiple build schemas. Currently used scheme: '${xcodeSchemes[0]}'. You can change it in the launch configuration.`;
    }
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
  const { deviceSessionsManager } = useDevices();
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
          deviceSessionsManager.reloadCurrentSession("autoReload");
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
