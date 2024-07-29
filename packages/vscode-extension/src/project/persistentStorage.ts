import { DeviceSettings } from "../common/Project";
import { extensionContext } from "../utilities/extensionContext";

function deviceSettingsKey(deviceId: string) {
  const DEVICE_SETTINGS_KEY = "device_settings_v2";

  return `${DEVICE_SETTINGS_KEY}_${deviceId}`;
}

export async function storeDeviceSettings(deviceId: string, settings: DeviceSettings) {
  await extensionContext.workspaceState.update(deviceSettingsKey(deviceId), settings);
}

export async function removeSettingsForDevice(deviceId: string) {
  await extensionContext.workspaceState.update(deviceSettingsKey(deviceId), undefined);
}

export function getDeviceSettings(deviceId: string): DeviceSettings {
  const DEFAULT_DEVICE_SETTINGS = {
    appearance: "dark",
    contentSize: "normal",
    location: {
      latitude: 50.048653,
      longitude: 19.965474,
      isDisabled: true,
    },
  } as const;

  const key = deviceSettingsKey(deviceId);

  return extensionContext.workspaceState.get(key) ?? DEFAULT_DEVICE_SETTINGS;
}
