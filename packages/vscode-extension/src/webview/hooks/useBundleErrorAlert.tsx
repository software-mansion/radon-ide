import { BundleErrorDescriptor } from "../../common/Project";
import IconButton from "../components/shared/IconButton";
import { useToggleableAlert } from "../providers/AlertProvider";
import { useDevices } from "../providers/DevicesProvider";
import { useProject } from "../providers/ProjectProvider";

function BundleErrorActions() {
  const { project } = useProject();
  const { deviceSessionsManager } = useDevices();
  return (
    <>
      <IconButton
        type="secondary"
        onClick={() => {
          project.focusDebugConsole();
        }}
        tooltip={{ label: "Open debug console", side: "bottom" }}>
        <span className="codicon codicon-output" />
      </IconButton>
      <IconButton
        type="secondary"
        onClick={() => {
          deviceSessionsManager.reloadCurrentSession("autoReload");
        }}
        tooltip={{ label: "Reload Metro", side: "bottom" }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
    </>
  );
}

export const bundleErrorAlert = {
  id: "bundle-error-alert",
  title: "Bundle error",
  description: "Open IDE logs to find out what went wrong.",
  actions: <BundleErrorActions />,
};

export function useBundleErrorAlert(errorDescriptor: BundleErrorDescriptor | undefined) {
  useToggleableAlert(errorDescriptor !== undefined, bundleErrorAlert);
}
