import { useEffect, useState } from "react";
import { useProject } from "../providers/ProjectProvider";
import { DeviceSettings, MultimediaData, ToolsState } from "../../common/DeviceSessionsManager";
import { DeviceState, StartupMessage } from "../../common/DeviceSession";
import { useDevices } from "../providers/DevicesProvider";
import { DeviceId } from "../../common/DeviceManager";

const defaultDeviceState: DeviceState = {
  status: "starting",
  startupMessage: StartupMessage.InitializingDevice,
  stageProgress: 0,
  previewURL: undefined,
  isActive: false,
  initialized: false,
  isProfilingCPU: false,
  isRecording: false,
};

const defaultDeviceSettings: DeviceSettings = {
  appearance: "dark",
  contentSize: "normal",
  hasEnrolledBiometrics: false,
  location: {
    latitude: 50.048653,
    longitude: 19.965474,
    isDisabled: false,
  },
  locale: "en_US",
  replaysEnabled: false,
  showTouches: false,
};

export function useSelectedDevice() {
  const selectedDeviceId = useProject().projectState.selectedDevice;
  const { deviceSessionsManager } = useDevices();

  const [deviceState, setDeviceState] = useState<DeviceState>(defaultDeviceState);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [toolsState, setToolsState] = useState<ToolsState>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isProfilingCPU, setIsProfilingCPU] = useState(false);
  const [replayData, setReplayData] = useState<MultimediaData | undefined>(undefined);

  const handleDeviceStateChanged = ({
    deviceId,
    deviceState,
  }: {
    deviceId: DeviceId;
    deviceState: DeviceState;
  }) => {
    if (deviceId !== selectedDeviceId) {
      return;
    }
    setDeviceState(deviceState);
  };

  const handleDeviceSettingsChanged = ({
    deviceId,
    deviceSettings,
  }: {
    deviceId: DeviceId;
    deviceSettings: DeviceSettings;
  }) => {
    if (deviceId !== selectedDeviceId) {
      return;
    }
    setDeviceSettings(deviceSettings);
  };

  const handleToolsStateChanged = ({
    deviceId,
    toolsState,
  }: {
    deviceId: DeviceId;
    toolsState: ToolsState;
  }) => {
    if (deviceId !== selectedDeviceId) {
      return;
    }
    setToolsState(toolsState);
  };

  const handleRecordingStateChanged = ({
    deviceId,
    isRecording,
  }: {
    deviceId: DeviceId;
    isRecording: boolean;
  }) => {
    if (deviceId !== selectedDeviceId) {
      return;
    }
    setIsRecording(isRecording);
  };

  const handleReplayDataCreated = ({
    deviceId,
    multimediaData,
  }: {
    deviceId: DeviceId;
    multimediaData: MultimediaData;
  }) => {
    if (deviceId !== selectedDeviceId) {
      return;
    }
    setReplayData(multimediaData);
  };

  const handleCPUProfilingStateChanged = ({
    deviceId,
    isProfiling,
  }: {
    deviceId: DeviceId;
    isProfiling: boolean;
  }) => {
    if (deviceId !== selectedDeviceId) {
      return;
    }
    setIsProfilingCPU(isProfiling);
  };

  useEffect(() => {
    if (!selectedDeviceId) {
      return;
    }
    deviceSessionsManager.getDeviceState(selectedDeviceId).then(setDeviceState);
    deviceSessionsManager.addListener("deviceStateChanged", handleDeviceStateChanged);

    deviceSessionsManager.getDeviceSettings(selectedDeviceId).then(setDeviceSettings);
    deviceSessionsManager.addListener("deviceSettingsChanged", handleDeviceSettingsChanged);

    deviceSessionsManager.getToolsState(selectedDeviceId).then(setToolsState);
    deviceSessionsManager.addListener("toolsStateChanged", handleToolsStateChanged);

    deviceSessionsManager.isRecording(selectedDeviceId).then(setIsRecording);
    deviceSessionsManager.addListener("isRecording", handleRecordingStateChanged);

    deviceSessionsManager.addListener("replayDataCreated", handleReplayDataCreated);

    deviceSessionsManager.isProfilingCPU(selectedDeviceId).then(setIsProfilingCPU);
    deviceSessionsManager.addListener("isProfilingCPU", handleCPUProfilingStateChanged);

    return () => {
      deviceSessionsManager.removeListener("deviceStateChanged", handleDeviceStateChanged);
      deviceSessionsManager.removeListener("deviceSettingsChanged", handleDeviceSettingsChanged);
      deviceSessionsManager.removeListener("toolsStateChanged", handleToolsStateChanged);
      deviceSessionsManager.removeListener("isRecording", handleRecordingStateChanged);
      setReplayData(undefined);
      deviceSessionsManager.removeListener("replayDataCreated", handleReplayDataCreated);
      deviceSessionsManager.removeListener("isProfilingCPU", handleCPUProfilingStateChanged);
    };
  }, [selectedDeviceId]);

  return {
    deviceState,
    deviceSettings,
    toolsState,
    isRecording,
    isProfilingCPU,
    replayData,
  };
}
