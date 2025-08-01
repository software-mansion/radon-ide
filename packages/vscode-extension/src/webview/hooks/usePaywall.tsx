import { useModal } from "../providers/ModalProvider";
import PaywallView from "../views/PaywallView";

export function usePaywall() {
  const { openModal } = useModal();

  const openPaywall = () => openModal(<PaywallView />, { fullScreen: true });

  return { openPaywall };
}
