import { useModal } from "../providers/ModalProvider";
import { useProject } from "../providers/ProjectProvider";
import AdminBlockView from "../views/AdminBlockView";

export function useAdminBlock() {
  const { project } = useProject();
  const { openModal } = useModal();

  const openAdminBlock = (title?: string) => {
    project.sendTelemetry("paywall:open");
    openModal(<AdminBlockView />, { fullscreen: true });
  };

  return { openAdminBlock };
}
