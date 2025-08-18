import { use$ } from "@legendapp/state/react";
import { useStore } from "../providers/storeProvider";
import { useSelectedSessionId } from "./useSelectedSessionId";

export const useFrameReporting = (): { enabled: boolean; fps: number | undefined } => {
  const store$ = useStore();
  const selectedSessionId = useSelectedSessionId();

  const enabled = use$(
    store$.projectState.deviceSessions[selectedSessionId!]?.frameReporting?.enabled ?? false
  );
  const fps = use$(
    store$.projectState.deviceSessions[selectedSessionId!]?.frameReporting?.frameReport?.fps ??
      undefined
  );

  return { enabled, fps };
};
