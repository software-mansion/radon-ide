import { useWorkspaceConfig } from "../../providers/WorkspaceConfigProvider";
import { DeviceProperties } from "../../utilities/deviceContants";

export function useDeviceFrame(device: DeviceProperties) {
  const workspace = useWorkspaceConfig();
  const isFrameDisabled = workspace.showDeviceFrame === false;
  const frame = isFrameDisabled ? device.bezel : device.skin;

  return frame;
}
