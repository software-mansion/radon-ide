import { Observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { DeviceInfo, State } from "../../common/State";

export function useDevices(store$: Observable<State>) {
  const devicesByType = use$(store$.devicesState.devicesByType);
  return (
    ["iosSimulators", "androidEmulators", "androidPhysicalDevices"] as const
  ).flatMap<DeviceInfo>((deviceType) => devicesByType?.[deviceType] ?? []);
}
