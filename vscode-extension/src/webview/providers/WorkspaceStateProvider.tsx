import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { vscode } from "../utilities/vscode";
import { Device } from "../utilities/device";
import { IosBuild } from "../../utilities/ios";
import { AndroidBuild } from "../../utilities/android";

type WorkspaceState =
  | {
      devices?: Device[];
      buildCache?: {
        enabled?: boolean;
        iOS?: {
          build?: IosBuild;
          buildHash?: string;
          fingerprintHash?: string;
        };
        android?: {
          build?: AndroidBuild;
          buildHash?: string;
          fingerprintHash?: string;
        };
      };
    }
  | undefined;

interface WorkspaceStateContextProps {
  state: WorkspaceState;
  devices: Device[];
  androidDevices: Device[];
  buildCacheEnabled: boolean;
  switchBuildCache: () => void;
  updateDevice: (device: Device) => void;
  updateDevices: (devices: Device[]) => void;
}

const WorkspaceStateContext = createContext<WorkspaceStateContextProps>({
  state: undefined,
  devices: [],
  androidDevices: [],
  buildCacheEnabled: false,
  switchBuildCache: () => undefined,
  updateDevice: (device: Device) => undefined,
  updateDevices: (devices: Device[]) => undefined,
});

export default function WorkspaceStateProvider({ children }: PropsWithChildren) {
  const [localState, setLocalState] = useState<WorkspaceState>(undefined);

  // Load state to local useState from persisting vscode storage.
  useEffect(() => {
    const listener = (event: any) => {
      const message = event.data;
      switch (message.command) {
        case "getState":
          const persistedState = message.state;
          setLocalState({
            ...persistedState,
            buildCache: { ...persistedState.buildCache, enabled: true },
          });
          break;
        case "stateUpdate":
          setLocalState(message.state);
          break;
      }
    };

    window.addEventListener("message", listener);

    vscode.postMessage({
      command: "getState",
    });

    return () => window.removeEventListener("message", listener);
  }, []);

  // Synchronize local state with the persistent one.
  useEffect(() => {
    if (localState) {
      vscode.postMessage({
        command: "setState",
        state: localState,
      });
    }
  }, [localState]);

  const androidDevices = useMemo(
    () => localState?.devices?.filter((device: Device) => device.platform === "Android") ?? [],
    [localState]
  );

  const devices = useMemo(() => localState?.devices ?? [], [localState]);

  const updateDevice = useCallback(
    (device: Device) => {
      if (!localState?.devices) {
        return;
      }
      const currentDevices = [...localState.devices];

      const indexOfDevice = currentDevices.findIndex(
        (currentDevice) => currentDevice.id === device.id
      );
      if (indexOfDevice < 0) {
        return;
      }

      currentDevices[indexOfDevice] = device;
      setLocalState((current: any) => ({ ...current, devices: currentDevices }));
    },
    [localState]
  );

  const updateDevices = useCallback((devices: Device[]) => {
    setLocalState((current: any) => ({ ...current, devices: devices }));
  }, []);

  const buildCacheEnabled = useMemo(() => {
    return !!localState?.buildCache?.enabled;
  }, [localState]);

  const switchBuildCache = useCallback(() => {
    setLocalState((current: any) => ({
      ...current,
      buildCache: { ...current.buildCache, enabled: !buildCacheEnabled },
    }));
  }, [buildCacheEnabled]);

  const value = useMemo(
    () => ({
      state: localState,
      androidDevices,
      updateDevice,
      updateDevices,
      devices,
      buildCacheEnabled,
      switchBuildCache,
    }),
    [
      localState,
      androidDevices,
      updateDevice,
      updateDevices,
      devices,
      buildCacheEnabled,
      switchBuildCache,
    ]
  );

  return <WorkspaceStateContext.Provider value={value}>{children}</WorkspaceStateContext.Provider>;
}

export function useWorkspaceStateContext() {
  const context = useContext(WorkspaceStateContext);

  if (context === undefined) {
    throw new Error("useWorkspaceStateContext must be used within a WorkspaceStateProvider");
  }
  return context;
}
