import { useCallback, useEffect } from "react";
import { VscodeButton as Button } from "@vscode-elements/react-elements";
import { useAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

const alertId = "devtools-disconnected-alert";

export function useApplicationDisconnectedAlert(shouldShow: boolean) {
  const { project } = useProject();
  const { openAlert, closeAlert } = useAlert();

  const open = useCallback(() => {
    openAlert({
      id: alertId,
      title: "Application disconnected from Radon IDE",
      description: "Some tools may not work as expected until the application is restarted.",
      priority: 0,
      closeable: true,
      type: "warning",
      actions: (
        <>
          <Button
            onClick={() => {
              project.reloadCurrentSession("autoReload");
            }}>
            <span className="codicon codicon-refresh" />
            Reload
          </Button>
        </>
      ),
    });
  }, [project, openAlert, close]);

  useEffect(() => {
    if (shouldShow) {
      open();
    } else {
      closeAlert(alertId);
    }
  }, [shouldShow]);
}
