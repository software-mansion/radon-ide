import { useModal } from "../providers/ModalProvider";
import { useProject } from "../providers/ProjectProvider";
import PaywallView from "../views/PaywallView";

export function usePaywall() {
  const { project } = useProject();
  const { openModal } = useModal();

  const openPaywall = () => {
    project.sendTelemetry("paywall:open");
    openModal(<PaywallView />, { fullScreen: true });
  };

  return { openPaywall };
}
