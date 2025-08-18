import { use$ } from "@legendapp/state/react";
import { useStore } from "../providers/storeProvider";

export const useSelectedSessionId = () => {
  const store$ = useStore();
  return use$(store$.projectState.selectedDeviceSessionId);
};
