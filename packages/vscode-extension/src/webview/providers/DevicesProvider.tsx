import {
  PropsWithChildren,
  useContext,
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { makeProxy } from "../utilities/rpc";
import {
  AndroidSystemImageInfo,
  DeviceInfo,
  DeviceManagerInterface,
  IOSRuntimeInfo,
} from "../../common/DeviceManager";
import { Platform } from "../providers/UtilsProvider";
import { DeviceSessionsManagerInterface } from "../../common/DeviceSessionsManager";

const DeviceManager = makeProxy<DeviceManagerInterface>("DeviceManager");
const DeviceSessionsManager = makeProxy<DeviceSessionsManagerInterface>("DeviceSessionsManager");

interface DevicesContextProps {
  devices: DeviceInfo[];
  androidImages: AndroidSystemImageInfo[];
  iOSRuntimes: IOSRuntimeInfo[];
  deviceManager: DeviceManagerInterface;
  deviceSessionsManager: DeviceSessionsManagerInterface;
  reload: () => void;
}

const DevicesContext = createContext<DevicesContextProps>({
  devices: [],
  androidImages: [],
  iOSRuntimes: [],
  deviceManager: DeviceManager,
  deviceSessionsManager: DeviceSessionsManager,
  reload: () => {},
});

export default function DevicesProvider({ children }: PropsWithChildren) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [androidImages, setAndroidImages] = useState<AndroidSystemImageInfo[]>([]);
  const [iOSRuntimes, setIOSRuntimes] = useState<IOSRuntimeInfo[]>([]);

  const reload = useCallback(async () => {
    const promises = [
      DeviceManager.listAllDevices().then(setDevices),
      DeviceManager.listInstalledAndroidImages().then(setAndroidImages),
    ];
    if (Platform.OS === "macos") {
      promises.push(DeviceManager.listInstalledIOSRuntimes().then(setIOSRuntimes));
    }
    await Promise.all(promises);
  }, [setDevices, setAndroidImages, setIOSRuntimes]);

  useEffect(() => {
    DeviceManager.addListener("devicesChanged", setDevices);
    reload();
    return () => {
      DeviceManager.removeListener("devicesChanged", setDevices);
    };
  }, []);

  const contextValue = useMemo(() => {
    return {
      devices,
      androidImages,
      iOSRuntimes,
      reload,
      deviceManager: DeviceManager,
      deviceSessionsManager: DeviceSessionsManager,
    };
  }, [devices, androidImages, iOSRuntimes, reload, DeviceManager]);

  return <DevicesContext.Provider value={contextValue}>{children}</DevicesContext.Provider>;
}

export function useDevices() {
  const context = useContext(DevicesContext);

  if (context === undefined) {
    throw new Error("useDevices must be used within a DevicesProvider");
  }
  return context;
}
