import { VscodeButton as Button } from "@vscode-elements/react-elements";
import { useToggleableAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import LaunchConfigurationView from "../views/LaunchConfigurationView";
import { BuildType } from "../../common/BuildConfig";
import { ProjectInterface } from "../../common/Project";
import { useAppRootConfig } from "../providers/ApplicationRootsProvider";
import { Output } from "../../common/OutputChannel";
import {
  BuildErrorDescriptor,
  DevicePlatform,
  FatalErrorDescriptor,
  InstallationErrorDescriptor,
  InstallationErrorReason,
  MetroErrorDescriptor,
  PreviewErrorDescriptor,
  PreviewErrorReason,
} from "../../common/State";

const FATAL_ERROR_ALERT_ID = "fatal-error-alert";

function BuildErrorActions({
  logsButtonDestination,
  onReload,
}: {
  logsButtonDestination?: Output;
  onReload?: () => void;
}) {
  const { project, projectState } = useProject();
  const { openModal } = useModal();
  return (
    <>
      <Button
        secondary
        onClick={() => {
          openModal(
            <LaunchConfigurationView
              launchConfig={projectState.selectedLaunchConfiguration}
              isCurrentConfig
            />,
            { title: "Launch Configuration" }
          );
        }}>
        Open Configuration
      </Button>
      <Button
        secondary
        data-testid="alert-open-logs-button"
        onClick={() => {
          project.focusOutput(logsButtonDestination ?? Output.Ide);
        }}>
        Open Logs
      </Button>
      <Button onClick={onReload}>
        <span className="codicon codicon-refresh" />
        Retry
      </Button>
    </>
  );
}

function BootErrorActions() {
  const { project } = useProject();
  return (
    <>
      <Button
        data-testid="alert-open-logs-button"
        onClick={() => {
          project.focusOutput(Output.Ide);
        }}>
        Open Logs
      </Button>
    </>
  );
}

function ErrorActionsWithReload() {
  const { project } = useProject();

  let onReload = () => {
    project.reloadCurrentSession("autoReload");
  };

  return (
    <>
      <Button
        secondary
        onClick={() => {
          project.focusOutput(Output.Ide);
        }}>
        Open Logs
      </Button>
      <Button onClick={onReload}>
        <span className="codicon codicon-refresh" />
        Retry
      </Button>
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
  hasSelectedScheme: boolean,
  xcodeSchemes: string[],
  project: ProjectInterface
) {
  let onReload = () => {
    project.reloadCurrentSession("autoReload");
  };
  let logsButtonDestination: Output | undefined = undefined;

  let description = "Open extension logs to find out what went wrong.";

  if (buildErrorDescriptor !== undefined) {
    const { buildType, message, platform } = buildErrorDescriptor;
    description = message;
    if (buildType && [BuildType.Local, BuildType.EasLocal, BuildType.Custom].includes(buildType)) {
      logsButtonDestination =
        platform === DevicePlatform.IOS ? Output.BuildIos : Output.BuildAndroid;
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

function createInstallationErrorAlert(installationErrorDescriptor: InstallationErrorDescriptor) {
  let description = installationErrorDescriptor.message;

  if (installationErrorDescriptor.reason === InstallationErrorReason.Unknown) {
    description =
      "An unknown error occurred while installing the application. See logs for more details.";
  }

  return {
    id: FATAL_ERROR_ALERT_ID,
    title: "Couldn't install application on selected device",
    description,
    actions: <ErrorActionsWithReload />,
  };
}

function createMetroErrorAlert(metroErrorDescriptor: MetroErrorDescriptor) {
  let description = metroErrorDescriptor.message;

  return {
    id: FATAL_ERROR_ALERT_ID,
    title: "Couldn't start the Metro server",
    description,
    actions: <ErrorActionsWithReload />,
  };
}

function createPreviewErrorAlert(previewErrorDescriptor: PreviewErrorDescriptor) {
  let description = previewErrorDescriptor.message;

  switch (previewErrorDescriptor.reason) {
    case PreviewErrorReason.StreamClosed: {
      description =
        "Device screen mirroring ended while the application was running. " +
        "Make sure the device is connected and try again.";
    }
  }

  return {
    id: FATAL_ERROR_ALERT_ID,
    title: "The device was disconnected from Radon",
    description,
    actions: <ErrorActionsWithReload />,
  };
}

export function useFatalErrorAlert(errorDescriptor: FatalErrorDescriptor | undefined) {
  let errorAlert = noErrorAlert;
  const { project, projectState } = useProject();
  const { appRoot, ios } = projectState.selectedLaunchConfiguration;
  const { xcodeSchemes } = useAppRootConfig(appRoot);

  if (errorDescriptor?.kind === "build") {
    errorAlert = createBuildErrorAlert(
      errorDescriptor,
      ios?.scheme !== undefined,
      xcodeSchemes || [],
      project
    );
  } else if (errorDescriptor?.kind === "device") {
    errorAlert = bootErrorAlert;
  } else if (errorDescriptor?.kind === "installation") {
    errorAlert = createInstallationErrorAlert(errorDescriptor);
  } else if (errorDescriptor?.kind === "metro") {
    errorAlert = createMetroErrorAlert(errorDescriptor);
  } else if (errorDescriptor?.kind === "preview") {
    errorAlert = createPreviewErrorAlert(errorDescriptor);
  }

  useToggleableAlert(errorDescriptor !== undefined, errorAlert);
}
