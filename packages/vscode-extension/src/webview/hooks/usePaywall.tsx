import { useModal } from "../providers/ModalProvider";
import { useUtils } from "../providers/UtilsProvider";
import PaywallView from "../views/PaywallView";

export function usePaywall() {
  const { sendTelemetry } = useUtils();
  const { openModal } = useModal();

  const openPaywall = () => {
    sendTelemetry("paywall:open");
    openModal(<PaywallView />, { fullScreen: true });
  };

  return { openPaywall };
}
