import { PropsWithChildren, useContext, createContext, useState, useEffect } from "react";
import { makeProxy } from "../utilities/rpc";
import {
  AndroidSystemImageInfo,
  DeviceInfo,
  DeviceManagerInterface,
  IOSRuntimeInfo,
} from "../../common/DeviceManager";

const DeviceManager = makeProxy<DeviceManagerInterface>("DeviceManager");

interface DevicesContextProps {
  devices: DeviceInfo[];
  androidImages: AndroidSystemImageInfo[];
  iOSRuntimes: IOSRuntimeInfo[];
  deviceManager: DeviceManagerInterface;
}

const DevicesContext = createContext<DevicesContextProps>({
  devices: [],
  androidImages: [],
  iOSRuntimes: [],
  deviceManager: DeviceManager,
});

export default function DevicesProvider({ children }: PropsWithChildren) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [androidImages, setAndroidImages] = useState<AndroidSystemImageInfo[]>([]);
  const [iOSRuntimes, setIOSRuntimes] = useState<IOSRuntimeInfo[]>([]);

  useEffect(() => {
    DeviceManager.addListener("devicesChanged", setDevices);
    DeviceManager.listAllDevices().then(setDevices);
    DeviceManager.listInstalledAndroidImages().then(setAndroidImages);
    DeviceManager.listInstalledIOSRuntimes().then(setIOSRuntimes);
    return () => {
      DeviceManager.removeListener("devicesChanged", setDevices);
    };
  }, []);

  return (
    <DevicesContext.Provider
      value={{ devices, androidImages, iOSRuntimes, deviceManager: DeviceManager }}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DevicesContext);

  if (context === undefined) {
    throw new Error("useWorkspaceStateContext must be used within a WorkspaceStateProvider");
  }
  return context;
}
