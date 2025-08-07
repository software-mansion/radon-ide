import { useCallback, useEffect } from "react";
import IconButton from "../components/shared/IconButton";
import { useAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

const alertId = "devtools-disconnected-alert";

export function useApplicationDisconnectedAlert(shouldShow: boolean) {
  const { project } = useProject();
  const { openAlert, closeAlert } = useAlert();

  const close = useCallback(() => {
    closeAlert(alertId);
  }, [closeAlert]);

  const open = useCallback(() => {
    openAlert({
      id: alertId,
      title: "Application disconnected from Radon IDE",
      description: "Some tools may not work as expected until the application is restarted.",
      priority: 0,
      actions: (
        <>
          <IconButton
            type="secondary"
            onClick={() => {
              project.reloadCurrentSession("autoReload");
              close();
            }}
            tooltip={{ label: "Restart application", side: "bottom" }}>
            <span className="codicon codicon-refresh" />
          </IconButton>
          <IconButton
            type="secondary"
            onClick={close}
            tooltip={{ label: "Close notification", side: "bottom" }}>
            <span className="codicon codicon-close" />
          </IconButton>
        </>
      ),
    });
  }, [project, openAlert, close]);

  useEffect(() => {
    if (shouldShow) {
      open();
    } else {
      close();
    }
  }, [shouldShow]);
}
