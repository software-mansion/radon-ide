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
          // FIXME: this should also clean-up the backend of the extension and not only reload the webview
          project.reloadWebview();
        }}
        tooltip={{ label: "Reload IDE", side: "bottom" }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
    </>
  );
}

const id = "build-error-alert";

export function useBuildErrorAlert(hasBuildError: boolean) {
  const { openAlert, isOpen, closeAlert } = useAlert();

  useEffect(() => {
    if (hasBuildError && !isOpen(id)) {
      openAlert({
        id,
        title: "Cannot run project",
        description: "Open build logs to find out what went wrong.",
        actions: <Actions />,
      });
    } else if (!hasBuildError && isOpen(id)) {
      closeAlert(id);
    }
  }, [hasBuildError, isOpen, openAlert, closeAlert]);
}
