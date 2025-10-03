import { WorkspaceConfiguration } from "vscode";
import {
  Appearance,
  CameraSettings,
  ContentSize,
  DeviceRotation,
  Locale,
  Location,
  MCPConfigLocation,
  PanelLocation,
  RecursivePartial,
  REMOVE,
  WorkspaceConfiguration as WorkspaceConfigurationState,
} from "../common/State";

const WorkspaceConfigurationKeyMap = {
  general: {
    defaultMultimediaSavingLocation: "general.defaultMultimediaSavingLocation",
    enableExperimentalElementInspector: "general.enableExperimentalElementInspector",
    inspectorExcludePattern: "general.inspectorExcludePattern",
  },
  userInterface: {
    panelLocation: "userInterface.panelLocation",
    showDeviceFrame: "userInterface.showDeviceFrame",
  },
  deviceSettings: {
    deviceRotation: "deviceSettings.deviceRotation",
    appearance: "deviceSettings.appearance",
    contentSize: "deviceSettings.contentSize",
    location: "deviceSettings.location",
    hasEnrolledBiometrics: "deviceSettings.hasEnrolledBiometrics",
    locale: "deviceSettings.locale",
    replaysEnabled: "deviceSettings.replaysEnabled",
    showTouches: "deviceSettings.showTouches",
    camera: "deviceSettings.camera",
  },
  deviceControl: {
    startDeviceOnLaunch: "deviceControl.startDeviceOnLaunch",
    stopPreviousDevices: "deviceControl.stopPreviousDevices",
  },
  radonAI: {
    enableRadonAI: "radonAI.enableRadonAI",
    MCPConfigLocation: "radonAI.MCPConfigLocation",
  },
};

export function getCurrentWorkspaceConfiguration(config: WorkspaceConfiguration) {
  const currentWorkspaceConfig: WorkspaceConfigurationState = {
    general: {
      inspectorExcludePattern:
        config.get<string>(WorkspaceConfigurationKeyMap.general.inspectorExcludePattern) ?? null,
      defaultMultimediaSavingLocation:
        config.get<string>(WorkspaceConfigurationKeyMap.general.defaultMultimediaSavingLocation) ??
        null,
      enableExperimentalElementInspector:
        config.get<boolean>(
          WorkspaceConfigurationKeyMap.general.enableExperimentalElementInspector
        ) ?? false,
    },
    userInterface: {
      panelLocation:
        config.get<PanelLocation>(WorkspaceConfigurationKeyMap.userInterface.panelLocation) ??
        "tab",
      showDeviceFrame:
        config.get<boolean>(WorkspaceConfigurationKeyMap.userInterface.showDeviceFrame) ?? true,
    },
    deviceControl: {
      startDeviceOnLaunch:
        config.get<boolean>(WorkspaceConfigurationKeyMap.deviceControl.startDeviceOnLaunch) ?? true,
      stopPreviousDevices:
        config.get<boolean>(WorkspaceConfigurationKeyMap.deviceControl.stopPreviousDevices) ??
        false,
    },
    deviceSettings: {
      deviceRotation:
        config.get<DeviceRotation>(WorkspaceConfigurationKeyMap.deviceSettings.deviceRotation) ??
        DeviceRotation.Portrait,
      appearance:
        config.get<Appearance>(WorkspaceConfigurationKeyMap.deviceSettings.appearance) ?? "dark",
      contentSize:
        config.get<ContentSize>(WorkspaceConfigurationKeyMap.deviceSettings.contentSize) ??
        "normal",
      location: config.get<Location>(WorkspaceConfigurationKeyMap.deviceSettings.location) ?? {
        latitude: 50.048653,
        longitude: 19.965474,
        isDisabled: false,
      },
      hasEnrolledBiometrics:
        config.get<boolean>(WorkspaceConfigurationKeyMap.deviceSettings.hasEnrolledBiometrics) ??
        false,
      locale: config.get<Locale>(WorkspaceConfigurationKeyMap.deviceSettings.locale) ?? "en_US",
      replaysEnabled:
        config.get<boolean>(WorkspaceConfigurationKeyMap.deviceSettings.replaysEnabled) ?? false,
      showTouches:
        config.get<boolean>(WorkspaceConfigurationKeyMap.deviceSettings.showTouches) ?? false,
      camera: config.get<CameraSettings>(WorkspaceConfigurationKeyMap.deviceSettings.camera) ?? {
        back: "emulated",
        front: "none",
      },
    },
    radonAI: {
      enableRadonAI:
        config.get<boolean>(WorkspaceConfigurationKeyMap.radonAI.enableRadonAI) ?? true,
      MCPConfigLocation:
        config.get<MCPConfigLocation>(WorkspaceConfigurationKeyMap.radonAI.MCPConfigLocation) ??
        "Project",
    },
  };

  return currentWorkspaceConfig;
}

interface KeyMap {
  [key: string]: string | KeyMap;
}

export async function updateWorkspaceConfig(
  config: WorkspaceConfiguration,
  change: RecursivePartial<WorkspaceConfigurationState>
): Promise<void> {
  function getConfigEntry<T>(partialState: RecursivePartial<T>, keyMap: KeyMap): [string, any] {
    const entries = Object.entries(partialState);
    if (entries.length > 1) {
      throw new Error("Partial state must have a single leaf");
    }
    if (entries.length === 0) {
      throw new Error("Partial state is empty");
    }

    const [key, value] = entries[0];

    if (typeof keyMap[key] === "string") {
      return [keyMap[key], value];
    }

    return getConfigEntry<T[keyof T]>(value as RecursivePartial<T[keyof T]>, keyMap[key]);
  }

  const configEntry = getConfigEntry<WorkspaceConfigurationState>(
    change,
    WorkspaceConfigurationKeyMap
  );

  if (configEntry[1] === REMOVE) {
    configEntry[1] = undefined;
  }

  if (config.inspect(configEntry[0])?.workspaceValue) {
    await config.update(configEntry[0], configEntry[1], false);
  } else {
    await config.update(configEntry[0], configEntry[1], true);
  }
}

export async function updatePartialWorkspaceConfig(
  config: WorkspaceConfiguration,
  partialStateEntry: [string, any]
): Promise<void> {
  if (config.inspect(partialStateEntry[0] as string)?.workspaceValue) {
    await config.update(partialStateEntry[0] as string, partialStateEntry[1], false);
  } else {
    await config.update(partialStateEntry[0] as string, partialStateEntry[1], true);
  }
}
