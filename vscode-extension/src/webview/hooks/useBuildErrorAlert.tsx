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
          project.focusDebugConsole();
        }}
        tooltip={{ label: "Open logs panel", side: "bottom" }}>
        <span className="codicon codicon-debug-console" />
      </IconButton>
      <IconButton
        type="secondary"
        onClick={() => {
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
        description: "Open logs panel to find out what went wrong.",
        actions: <Actions />,
      });
    } else if (!hasBuildError && isOpen(id)) {
      closeAlert(id);
    }
  }, [hasBuildError, isOpen, openAlert, closeAlert]);
}
