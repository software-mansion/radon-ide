import { useCallback, useEffect } from "react";
import { useAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";
import Button from "../components/shared/Button";

const alertId = "devtools-disconnected-alert";

export function useApplicationDisconnectedAlert(shouldShow: boolean) {
  const { project } = useProject();
  const { openAlert } = useAlert();

  const open = useCallback(() => {
    openAlert({
      id: alertId,
      title: "Application disconnected from Radon IDE",
      description: "Some tools may not work as expected until the application is restarted.",
      priority: 0,
      closeable: true,
      actions: (
        <>
          <Button
            type="secondary"
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
      close();
    }
  }, [shouldShow]);
}
