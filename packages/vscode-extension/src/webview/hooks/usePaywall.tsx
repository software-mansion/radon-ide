import { Feature } from "../../common/License";
import { useModal } from "../providers/ModalProvider";
import { useProject } from "../providers/ProjectProvider";
import PaywallView from "../views/PaywallView";

export function usePaywall() {
  const { project } = useProject();
  const { openModal } = useModal();

  const openPaywall = (title?: string, proFeature?: Feature) => {
    project.sendTelemetry("paywall:open");
    openModal(<PaywallView title={title} proFeature={proFeature} />, { fullscreen: true });
  };

  return { openPaywall };
}
