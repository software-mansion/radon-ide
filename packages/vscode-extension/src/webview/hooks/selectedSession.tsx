import { use$ } from "@legendapp/state/react";
import { useStore } from "../providers/storeProvider";

export const useSelectedSessionId = () => {
  const store$ = useStore();
  return use$(store$.projectState.selectedDeviceSessionId);
};

export const useSelectedDeviceSessionState = () => {
  const store$ = useStore();
  const selectedSessionId = useSelectedSessionId();

  const deviceSessionState = store$.projectState.deviceSessions[selectedSessionId!];

  return deviceSessionState;
};
