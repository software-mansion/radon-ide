import { useToggleableAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

import IconButton from "../components/shared/IconButton";
import { useModal } from "../providers/ModalProvider";
import LaunchConfigurationView from "../views/LaunchConfigurationView";
import { BuildType } from "../../common/BuildConfig";
import { useDevices } from "../providers/DevicesProvider";
import { BuildErrorDescriptor, FatalErrorDescriptor } from "../../common/Project";
import { DeviceSessionsManagerInterface } from "../../common/DeviceSessionsManager";
import { useAppRootConfig } from "../providers/ApplicationRootsProvider";

type LogsButtonDestination = "build" | "extension";

const FATAL_ERROR_ALERT_ID = "fatal-error-alert";

function BuildErrorActions({
  logsButtonDestination,
  onReload,
}: {
  logsButtonDestination?: LogsButtonDestination;
  onReload?: () => void;
}) {
  const { project, projectState } = useProject();
  const { openModal } = useModal();
  return (
    <>
      <IconButton
        type="secondary"
        onClick={() => {
          openModal(
            "Launch Configuration",
            <LaunchConfigurationView
              launchConfigToUpdate={projectState.selectedLaunchConfiguration}
            />
          );
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

const bootErrorAlert = {
  id: FATAL_ERROR_ALERT_ID,
  title: "Couldn't start selected device",
  description:
    "Perhaps the device runtime is not installed or your computer has run out of space. Open IDE logs to find out what went wrong.",
  actions: <BootErrorActions />,
};

const noErrorAlert = {
  id: FATAL_ERROR_ALERT_ID,
  title: "",
  description: "",
  actions: null as React.ReactNode,
};

function createBuildErrorAlert(
  buildErrorDescriptor: BuildErrorDescriptor,
  deviceSessionsManager: DeviceSessionsManagerInterface,
  hasSelectedScheme: boolean,
  xcodeSchemes: string[]
) {
  let onReload = () => {
    deviceSessionsManager.reloadCurrentSession("autoReload");
  };
  let logsButtonDestination: LogsButtonDestination | undefined = undefined;

  let description = "Open extension logs to find out what went wrong.";

  if (buildErrorDescriptor !== undefined) {
    const { buildType, message } = buildErrorDescriptor;
    description = message;
    if (buildType && [BuildType.Local, BuildType.EasLocal, BuildType.Custom].includes(buildType)) {
      logsButtonDestination = "build";
    } else {
      logsButtonDestination = "extension";
    }

    if (buildType === null && !hasSelectedScheme && xcodeSchemes.length > 1) {
      description = `Your project uses multiple build schemas. Currently used scheme: '${xcodeSchemes[0]}'. You can change it in the launch configuration.`;
    }
  }

  const actions = (
    <BuildErrorActions logsButtonDestination={logsButtonDestination} onReload={onReload} />
  );

  return {
    id: FATAL_ERROR_ALERT_ID,
    title: "Cannot run project",
    description,
    actions,
  };
}

export function useFatalErrorAlert(errorDescriptor: FatalErrorDescriptor | undefined) {
  let errorAlert = noErrorAlert;
  const { projectState } = useProject();
  const { absoluteAppRoot, ios } = projectState.selectedLaunchConfiguration;
  const { xcodeSchemes } = useAppRootConfig(absoluteAppRoot);
  const { deviceSessionsManager } = useDevices();

  if (errorDescriptor?.kind === "build") {
    errorAlert = createBuildErrorAlert(
      errorDescriptor,
      deviceSessionsManager,
      ios?.scheme !== undefined,
      xcodeSchemes || []
    );
  } else if (errorDescriptor?.kind === "device") {
    errorAlert = bootErrorAlert;
  }

  useToggleableAlert(errorDescriptor !== undefined, errorAlert);
}
