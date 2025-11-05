import { use$ } from "@legendapp/state/react";
import { useStore } from "../providers/storeProvider";
import { Observable } from "@legendapp/state";
import { DeviceSessionStore } from "../../common/State";

export const useSelectedSessionId = () => {
  const store$ = useStore();
  return use$(store$.projectState.selectedDeviceSessionId);
};

export const useSelectedDeviceSessionState = () => {
  const store$ = useStore();
  const selectedSessionId = useSelectedSessionId();

  const deviceSessionState = store$.projectState.deviceSessions[selectedSessionId!];

  return deviceSessionState as Observable<DeviceSessionStore | undefined>;
};
