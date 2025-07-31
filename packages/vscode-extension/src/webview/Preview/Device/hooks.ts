import { use$ } from "@legendapp/state/react";
import { DeviceProperties } from "../../utilities/deviceConstants";
import { useStore } from "../../providers/storeProvider";

export function useDeviceFrame(device: DeviceProperties) {
  const store$ = useStore();
  const showDeviceFrame = use$(store$.workspaceConfiguration.showDeviceFrame);
  const isFrameDisabled = showDeviceFrame === false;
  const frame = isFrameDisabled ? device.bezel : device.skin;

  return frame;
}
