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
  isLoading: boolean;
  androidImages: AndroidSystemImageInfo[];
  iOSRuntimes: IOSRuntimeInfo[];
  deviceManager: DeviceManagerInterface;
  reload: () => void;
}

const DevicesContext = createContext<DevicesContextProps>({
  devices: [],
  isLoading: true,
  androidImages: [],
  iOSRuntimes: [],
  deviceManager: DeviceManager,
  reload: () => {},
});

export default function DevicesProvider({ children }: PropsWithChildren) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [androidImages, setAndroidImages] = useState<AndroidSystemImageInfo[]>([]);
  const [iOSRuntimes, setIOSRuntimes] = useState<IOSRuntimeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      DeviceManager.listAllDevices().then(setDevices),
      DeviceManager.listInstalledAndroidImages().then(setAndroidImages),
      DeviceManager.listInstalledIOSRuntimes().then(setIOSRuntimes),
    ]);
    setIsLoading(false);
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
      value={{
        devices,
        isLoading,
        androidImages,
        iOSRuntimes,
        reload,
        deviceManager: DeviceManager,
      }}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DevicesContext);

  if (context === undefined) {
    throw new Error("useDevices must be used within a DevicesProvider");
  }
  return context;
}
