import { BundleErrorDescriptor } from "../../common/State";
import Button from "../components/shared/Button";
import { useToggleableAlert } from "../providers/AlertProvider";
import { useProject } from "../providers/ProjectProvider";

function BundleErrorActions() {
  const { project } = useProject();
  return (
    <>
      <Button
        type="secondary"
        onClick={() => {
          project.focusDebugConsole();
        }}>
        Open Debug Console
      </Button>
      <Button
        type="primary"
        onClick={() => {
          project.reloadCurrentSession("autoReload");
        }}>
        <span className="codicon codicon-refresh" />
        Reload
      </Button>
    </>
  );
}

export const bundleErrorAlert = {
  id: "bundle-error-alert",
  title: "Bundle error",
  description: "Open IDE logs to find out what went wrong.",
  actions: <BundleErrorActions />,
};

export function useBundleErrorAlert(errorDescriptor: BundleErrorDescriptor | null | undefined) {
  useToggleableAlert(errorDescriptor !== null && errorDescriptor !== undefined, bundleErrorAlert);
}
