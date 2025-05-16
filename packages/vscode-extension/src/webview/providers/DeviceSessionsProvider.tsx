import { PropsWithChildren, useContext, createContext, useState, useEffect, useMemo } from "react";
import { makeProxy } from "../utilities/rpc";
import {
  DeviceSessionsManagerInterface,
  DeviceSettings,
  MultimediaData,
  ToolsState,
} from "../../common/DeviceSessionsManager";
import { DeviceId } from "../../common/DeviceManager";
import { DeviceState } from "../../project/deviceSession";
import { Disposable } from "vscode";

export function useSelectedDevice() {}

const deviceSessionsManager = makeProxy<DeviceSessionsManagerInterface>("DeviceSessionsManager");

interface DeviceSessionsContextProps {
  onStateChanged: (
    deviceId: DeviceId,
    listener: (newState: DeviceSessionState) => void
  ) => Disposable;
  runningDevices: DeviceId[];
  deviceStateMap: Map<DeviceId, DeviceState>;
  deviceSettingsMap: Map<DeviceId, DeviceSettings>;
  toolsStateMap: Map<DeviceId, ToolsState>;
  replayDataMap: Map<DeviceId, MultimediaData>;
  isRecordingMap: Map<DeviceId, boolean>;
  isProfilingCPUMap: Map<DeviceId, boolean>;
  deviceSessionsManager: DeviceSessionsManagerInterface;
}

const DeviceSessionsContext = createContext<DeviceSessionsContextProps>({
  onStateChanged: (deviceId: DeviceId, listener: (newState: DeviceSessionState) => void) => {
    return new Disposable(() => {});
  },
  runningDevices: [],
  deviceStateMap: new Map<DeviceId, DeviceState>(),
  deviceSettingsMap: new Map<DeviceId, DeviceSettings>(),
  toolsStateMap: new Map<DeviceId, ToolsState>(),
  replayDataMap: new Map<DeviceId, MultimediaData>(),
  isRecordingMap: new Map<DeviceId, boolean>(),
  isProfilingCPUMap: new Map<DeviceId, boolean>(),
  deviceSessionsManager,
});

export type DeviceSessionState = {
  deviceState?: DeviceState;
  deviceSettings?: DeviceSettings;
  toolsState?: ToolsState;
  multimediaData?: MultimediaData;
  isRecording?: boolean;
  isProfilingCPU?: boolean;
};

export default function DeviceSessionsProvider({ children }: PropsWithChildren) {
  const [runningDevices, setRunningDevices] = useState<DeviceId[]>([]);
  const deviceStateMap = new Map<DeviceId, DeviceState>();
  const deviceSettingsMap = new Map<DeviceId, DeviceSettings>();
  const toolsStateMap = new Map<DeviceId, ToolsState>();
  const replayDataMap = new Map<DeviceId, MultimediaData>();
  const isRecordingMap = new Map<DeviceId, boolean>();
  const isProfilingCPUMap = new Map<DeviceId, boolean>();

  const deviceSessionStateChangeListeners = new Map<
    DeviceId,
    ((newState: DeviceSessionState) => void)[]
  >();

  const onStateChanged = (deviceId: DeviceId, listener: (newState: DeviceSessionState) => void) => {
    const oldListeners = deviceSessionStateChangeListeners.get(deviceId) ?? [];

    deviceSessionStateChangeListeners.set(deviceId, [...oldListeners, listener]);

    return new Disposable(() => {
      deviceSessionStateChangeListeners.set(
        deviceId,
        deviceSessionStateChangeListeners.get(deviceId)?.filter((l) => listener !== l) ?? []
      );
    });
  };

  const callListenersForDevice = (deviceId: DeviceId) => {
    const listenersForDevice = deviceSessionStateChangeListeners.get(deviceId) ?? [];

    listenersForDevice.forEach((listener) => {
      listener({
        deviceState: deviceStateMap.get(deviceId),
        deviceSettings: deviceSettingsMap.get(deviceId),
        toolsState: toolsStateMap.get(deviceId),
        multimediaData: replayDataMap.get(deviceId),
        isRecording: isRecordingMap.get(deviceId),
        isProfilingCPU: isProfilingCPUMap.get(deviceId),
      });
    });
  };

  const handleNewRunningDevices = (newRunningDevices: DeviceId[]) => {
    newRunningDevices.forEach((d) => {
      deviceSessionsManager.getDeviceState(d).then((deviceState) => {
        deviceStateMap.set(d, deviceState);
      });
      deviceSessionsManager.getDeviceSettings(d).then((deviceSettings) => {
        deviceSettingsMap.set(d, deviceSettings);
      });
      deviceSessionsManager.getToolsState(d).then((toolsState) => {
        toolsStateMap.set(d, toolsState);
      });
    });
  };

  const handleRunningDevicesChanged = (newRunningDevices: DeviceId[]) => {
    const oldRunningDevices = runningDevices;
    const removedDevices = oldRunningDevices.filter((d) => !newRunningDevices.includes(d));

    removedDevices.forEach((d) => {
      deviceStateMap.delete(d);
      deviceSettingsMap.delete(d);
      toolsStateMap.delete(d);
      replayDataMap.delete(d);
      isRecordingMap.delete(d);
      isProfilingCPUMap.delete(d);
    });

    const addedDevices = newRunningDevices.filter((d) => !oldRunningDevices.includes(d));

    handleNewRunningDevices(addedDevices);

    setRunningDevices(newRunningDevices);
  };

  const handleDeviceStateChanged = ({
    deviceId,
    deviceState,
  }: {
    deviceId: DeviceId;
    deviceState: DeviceState;
  }) => {
    deviceStateMap.set(deviceId, deviceState);
    callListenersForDevice(deviceId);
  };

  const handleDeviceSettingsChanged = ({
    deviceId,
    deviceSettings,
  }: {
    deviceId: DeviceId;
    deviceSettings: DeviceSettings;
  }) => {
    deviceSettingsMap.set(deviceId, deviceSettings);
    callListenersForDevice(deviceId);
  };

  const handleToolsStateChanged = ({
    deviceId,
    toolsState,
  }: {
    deviceId: DeviceId;
    toolsState: ToolsState;
  }) => {
    toolsStateMap.set(deviceId, toolsState);
    callListenersForDevice(deviceId);
  };

  const handleRecordingStateChanged = ({
    deviceId,
    isRecording,
  }: {
    deviceId: DeviceId;
    isRecording: boolean;
  }) => {
    isRecordingMap.set(deviceId, isRecording);
    callListenersForDevice(deviceId);
  };

  const handleReplayDataCreated = ({
    deviceId,
    multimediaData,
  }: {
    deviceId: DeviceId;
    multimediaData: MultimediaData;
  }) => {
    replayDataMap.set(deviceId, multimediaData);
    callListenersForDevice(deviceId);
  };

  const handleProfilingCPUChanged = ({
    deviceId,
    isProfiling,
  }: {
    deviceId: DeviceId;
    isProfiling: boolean;
  }) => {
    isProfilingCPUMap.set(deviceId, isProfiling);
    callListenersForDevice(deviceId);
  };

  useEffect(() => {
    deviceSessionsManager.listRunningDevices().then((runningDevices) => {
      handleNewRunningDevices(runningDevices);
      setRunningDevices(runningDevices);
    });
    deviceSessionsManager.addListener("runningDevicesChanged", handleRunningDevicesChanged);

    deviceSessionsManager.addListener("deviceStateChanged", handleDeviceStateChanged);

    deviceSessionsManager.addListener("deviceSettingsChanged", handleDeviceSettingsChanged);

    deviceSessionsManager.addListener("toolsStateChanged", handleToolsStateChanged);

    deviceSessionsManager.addListener("isRecording", handleRecordingStateChanged);

    deviceSessionsManager.addListener("replayDataCreated", handleReplayDataCreated);

    deviceSessionsManager.addListener("isProfilingCPU", handleProfilingCPUChanged);

    return () => {
      deviceSessionsManager.removeListener("runningDevicesChanged", handleRunningDevicesChanged);
      deviceSessionsManager.removeListener("deviceStateChanged", handleDeviceStateChanged);
      deviceSessionsManager.removeListener("deviceSettingsChanged", handleDeviceSettingsChanged);
      deviceSessionsManager.removeListener("toolsStateChanged", handleToolsStateChanged);
      deviceSessionsManager.removeListener("isRecording", handleRecordingStateChanged);
      deviceSessionsManager.removeListener("replayDataCreated", handleReplayDataCreated);
      deviceSessionsManager.removeListener("isProfilingCPU", handleProfilingCPUChanged);
    };
  }, []);

  const contextValue = useMemo(() => {
    return {
      onStateChanged,
      runningDevices,
      deviceSessionsManager,
      deviceStateMap,
      deviceSettingsMap,
      toolsStateMap,
      replayDataMap,
      isRecordingMap,
      isProfilingCPUMap,
    };
  }, [
    onStateChanged,
    runningDevices,
    deviceSessionsManager,
    deviceStateMap,
    deviceSettingsMap,
    toolsStateMap,
    replayDataMap,
    isRecordingMap,
    isProfilingCPUMap,
  ]);

  return (
    <DeviceSessionsContext.Provider value={contextValue}>{children}</DeviceSessionsContext.Provider>
  );
}

export function useDeviceSessions() {
  const context = useContext(DeviceSessionsContext);

  if (context === undefined) {
    throw new Error("useDeviceSessions must be used within a DeviceSessionsProvider");
  }
  return context;
}

export function useDeviceSessionState(id: DeviceId) {
  const { onStateChanged } = useDeviceSessions();
  const [state, setState] = useState<DeviceSessionState>({});
  useEffect(() => {
    return onStateChanged(id, setState).dispose;
  }, [id]);
  return state;
}
