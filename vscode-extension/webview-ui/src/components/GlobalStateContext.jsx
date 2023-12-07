import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { vscode } from "../utilities/vscode";
import { DEVICES } from "../utilities/consts";

const GlobalStateContext = createContext({
  state: undefined,
  androidDevices: [],
  updateDevice: (device) => null,
  updateDevices: (devices) => null,
});

export default function GlobalStateProvider({ children }) {
  const [localState, setLocalState] = useState(undefined);

  // Load state to local useState from persisting vscode storage.
  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      switch (message.command) {
        case "getState":
          const persistedState = message.state;
          if (!persistedState) {
            const newState = { devices: DEVICES };
            vscode.postMessage({
              command: "setState",
              state: newState,
            });
            setLocalState(newState);
          } else {
            setLocalState(persistedState);
          }
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
    vscode.postMessage({
      command: "setState",
      state: localState,
    });
  }, [localState]);

  const androidDevices = useMemo(
    () => localState?.devices?.filter((device) => device.platform === "Android") ?? [],
    [localState]
  );

  const updateDevice = useCallback(
    (device) => {
      const currentDevices = [...localState.devices];
      if (!currentDevices) {
        return;
      }

      const indexOfDevice = currentDevices.findIndex(
        (currentDevice) => currentDevice.id === device.id
      );
      if (indexOfDevice < 0) {
        return;
      }

      currentDevices[indexOfDevice] = device;
      setLocalState((current) => ({ ...current, devices: currentDevices }));
    },
    [localState]
  );

  const updateDevices = useCallback(
    (devices) => {
      setLocalState((current) => ({ ...current, devices: devices }));
    },
    []
  );

  const value = useMemo(
    () => ({
      state: localState,
      androidDevices,
      updateDevice,
      updateDevices,
    }),
    [localState, androidDevices, updateDevice, updateDevices]
  );

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
}

export function useGlobalStateContext() {
  return useContext(GlobalStateContext);
}
