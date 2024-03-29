import { useEffect } from "react";

import { useAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

import IconButton from "../components/shared/IconButton";

function Actions() {
  const { project } = useProject();
  return (
    <>
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
          project.restart(true);
        }}
        tooltip={{ label: "Reload IDE", side: "bottom" }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
    </>
  );
}

const buildErrorAlertId = "build-error-alert";

export function useBuildErrorAlert(shouldDisplayAlert: boolean) {
  const { openAlert, isOpen, closeAlert } = useAlert();

  useEffect(() => {
    if (shouldDisplayAlert && !isOpen(buildErrorAlertId)) {
      openAlert({
        id: buildErrorAlertId,
        title: "Cannot run project",
        description: "Open build logs to find out what went wrong.",
        actions: <Actions />,
      });
    } else if (!shouldDisplayAlert && isOpen(buildErrorAlertId)) {
      closeAlert(buildErrorAlertId);
    }
  }, [shouldDisplayAlert, isOpen, openAlert, closeAlert]);
}

const bundleErrorAlertId = "bundle-error-alert";

export function useBundleErrorAlert(shouldDisplayAlert: boolean) {
  const { openAlert, isOpen, closeAlert } = useAlert();
  useEffect(() => {
    if (shouldDisplayAlert && !isOpen(bundleErrorAlertId)) {
      openAlert({
        id: bundleErrorAlertId,
        title: "Bundle error",
        description: "Open build logs to find out what went wrong.",
        actions: <Actions />,
      });
    } else if (!shouldDisplayAlert && isOpen(bundleErrorAlertId)) {
      closeAlert(bundleErrorAlertId);
    }
  }, [shouldDisplayAlert, isOpen, openAlert, closeAlert]);
}
