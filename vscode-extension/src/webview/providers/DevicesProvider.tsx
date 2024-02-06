import {
  PropsWithChildren,
  useContext,
  createContext,
  useState,
  useEffect,
  useCallback,
} from "react";
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
  reload: () => void;
}

const DevicesContext = createContext<DevicesContextProps>({
  devices: [],
  androidImages: [],
  iOSRuntimes: [],
  deviceManager: DeviceManager,
  reload: () => {},
});

export default function DevicesProvider({ children }: PropsWithChildren) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [androidImages, setAndroidImages] = useState<AndroidSystemImageInfo[]>([]);
  const [iOSRuntimes, setIOSRuntimes] = useState<IOSRuntimeInfo[]>([]);

  const reload = useCallback(() => {
    DeviceManager.listAllDevices().then(setDevices);
    DeviceManager.listInstalledAndroidImages().then(setAndroidImages);
    DeviceManager.listInstalledIOSRuntimes().then(setIOSRuntimes);
  }, [setDevices, setAndroidImages, setIOSRuntimes]);

  useEffect(() => {
    DeviceManager.addListener("devicesChanged", setDevices);
    reload();
    return () => {
      DeviceManager.removeListener("devicesChanged", setDevices);
    };
  }, []);

  return (
    <DevicesContext.Provider
      value={{ devices, androidImages, iOSRuntimes, reload, deviceManager: DeviceManager }}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useDevices(reload = false) {
  const context = useContext(DevicesContext);

  useEffect(() => {
    if (reload) {
      context.reload();
    }
  }, [reload]);

  if (context === undefined) {
    throw new Error("useDevices must be used within a DevicesProvider");
  }
  return context;
}
