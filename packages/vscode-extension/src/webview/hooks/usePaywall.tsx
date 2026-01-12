import { Feature } from "../../common/License";
import { useModal } from "../providers/ModalProvider";
import { useProject } from "../providers/ProjectProvider";
import PaywallView from "../views/PaywallView";

interface OpenPaywallOptions {
  title?: string;
  feature?: Feature;
}

export function usePaywall() {
  const { project } = useProject();
  const { openModal } = useModal();

  const openPaywall = ({ title, feature }: OpenPaywallOptions = {}) => {
    project.sendTelemetry("paywall:open");
    openModal(<PaywallView title={title} feature={feature} />, { fullscreen: true });
  };

  return { openPaywall };
}
