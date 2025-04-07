import { useCallback } from "react";
import IconButton from "../components/shared/IconButton";
import { useAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

type Props = {
  closeAlert: () => void;
};

function Actions({ closeAlert }: Props) {
  const { project } = useProject();
  return (
    <>
      <IconButton
        type="secondary"
        onClick={() => {
          project.reload("rebuild");
          closeAlert();
        }}
        tooltip={{ label: "Rebuild", side: "bottom" }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
      <IconButton
        type="secondary"
        onClick={closeAlert}
        tooltip={{ label: "Close notification", side: "bottom" }}>
        <span className="codicon codicon-close" />
      </IconButton>
    </>
  );
}

export function useNativeRebuildAlert() {
  const { openAlert, closeAlert, isOpen } = useAlert();
  const alertId = "native-changed-alert";

  return useCallback(() => {
    if (!isOpen(alertId)) {
      openAlert({
        id: alertId,
        title: "Native dependencies changed",
        description: "Click the button to rebuild the project",
        priority: 1,
        actions: <Actions closeAlert={() => closeAlert(alertId)} />,
      });
    }
  }, [alertId, openAlert, closeAlert, isOpen]);
}
