import { useEffect, useMemo, useState } from "react";
import { VscodeButton as Button } from "@vscode-elements/react-elements";
import { useToggleableAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

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

export function useNativeRebuildAlert(needsRebuild: boolean) {
  const [open, setOpen] = useState(needsRebuild);

  useEffect(() => {
    setOpen(needsRebuild);
  }, [needsRebuild]);

  const alertDescriptor = useMemo(
    () =>
      ({
        id: "native-changed-alert",
        title: "Native dependencies changed",
        description: "Click the button to rebuild the project",
        priority: 1,
        closeable: true,
        type: "warning",
        actions: <Actions closeAlert={() => setOpen(false)} />,
      }) as const,
    []
  );

  return useToggleableAlert(open, alertDescriptor);
}
