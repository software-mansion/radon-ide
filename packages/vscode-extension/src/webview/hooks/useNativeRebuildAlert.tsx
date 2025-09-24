import { useCallback } from "react";
import { useAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";
import { VscodeButton as Button } from "@vscode-elements/react-elements";

type Props = {
  closeAlert: () => void;
};

function Actions({ closeAlert }: Props) {
  const { project } = useProject();
  return (
    <>
      <Button secondary onClick={closeAlert}>
        Cancel
      </Button>
      <Button
        onClick={() => {
          project.reloadCurrentSession("rebuild");
          closeAlert();
        }}>
        <span className="codicon codicon-refresh" />
        Rebuild
      </Button>
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
        closeable: true,
        type: "warning",
        actions: <Actions closeAlert={() => closeAlert(alertId)} />,
      });
    }
  }, [alertId, openAlert, closeAlert, isOpen]);
}
