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
import { DEVICES } from "../utilities/consts";
import { Device } from "../utilities/device";
import { IosBuild } from "../../utilities/ios";
import { AndroidBuild } from "../../utilities/android";

type GlobalState =
  | {
      devices: Device[];
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

interface GlobalStateContextProps {
  state: GlobalState;
  devices: Device[];
  androidDevices: Device[];
  buildCacheEnabled: boolean;
  switchBuildCache: () => void;
  updateDevice: (device: Device) => void;
  updateDevices: (devices: Device[]) => void;
}

const GlobalStateContext = createContext<GlobalStateContextProps>({
  state: undefined,
  devices: [],
  androidDevices: [],
  buildCacheEnabled: false,
  switchBuildCache: () => undefined,
  updateDevice: (device: Device) => undefined,
  updateDevices: (devices: Device[]) => undefined,
});

export default function GlobalStateProvider({ children }: PropsWithChildren) {
  const [localState, setLocalState] = useState<GlobalState>(undefined);

  // Load state to local useState from persisting vscode storage.
  useEffect(() => {
    const listener = (event: any) => {
      const message = event.data;
      switch (message.command) {
        case "getState":
          const persistedState = null; //message.state;
          if (!persistedState) {
            const newState: GlobalState = {
              devices: [] as Device[],
              buildCache: { enabled: true },
            };
            vscode.postMessage({
              command: "setState",
              state: newState,
            });
            setLocalState(newState);
          } else {
            setLocalState(persistedState);
          }
          break;
        case "stateUpdate":
          const newState = message.state;
          setLocalState(newState);
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

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
}

export function useGlobalStateContext() {
  const context = useContext(GlobalStateContext);

  if (context === undefined) {
    throw new Error("useGlobalStateContext must be used within a GlobalStateProvider");
  }
  return context;
}
