import Select from "../components/shared/Select";
import "./CreateDeviceView.css";
import { useEffect, useState } from "react";
import { useDevices } from "../providers/DevicesProvider";
import Button from "../components/shared/Button";
import Label from "../components/shared/Label";
import {
  DeviceProperties,
  iOSSupportedDevices,
  AndroidSupportedDevices,
} from "../utilities/consts";
import { DevicePlatform } from "../../common/DeviceManager";
import { useDependencies } from "../providers/DependenciesProvider";
import { Platform } from "../providers/UtilsProvider";

interface CreateDeviceViewProps {
  onCreate: () => void;
  onCancel: () => void;
}

function assertPlatform(platform: string): asserts platform is "ios" | "android" {
  if (!(platform === "ios" || platform === "android")) {
    throw new Error("Invalid platform specifier");
  }
}

function useSupportedDevices() {
  const { errors } = useDependencies();

  function buildSelections(item: DeviceProperties, platform: DevicePlatform) {
    let prefix = "";
    if (platform === DevicePlatform.IOS) {
      prefix = "ios";
    } else {
      prefix = "android";
    }
    return { value: `${prefix}:${item.displayName}:${item.deviceName}`, label: item.displayName };
  }

  return [
    Platform.select({
      macos: errors?.simulator
        ? { label: "iOS – error, check diagnostics", items: [] }
        : {
            label: "iOS",
            items: iOSSupportedDevices.map((device) => buildSelections(device, DevicePlatform.IOS)),
          },
      windows: { label: "", items: [] },
    }),
    errors?.emulator
      ? { label: "Android – error, check diagnostics", items: [] }
      : {
          label: "Android",
          items: AndroidSupportedDevices.map((device) =>
            buildSelections(device, DevicePlatform.Android)
          ),
        },
  ];
}

function CreateDeviceView({ onCreate, onCancel }: CreateDeviceViewProps) {
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined);
  const [devicePlatform, setDevicePlatform] = useState<"ios" | "android" | undefined>(undefined);
  const [selectedSystemName, selectSystemName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  const supportedDevices = useSupportedDevices();
  const { iOSRuntimes, androidImages, deviceManager, reload } = useDevices();

  useEffect(() => {
    reload();
  }, []);

  const platformSelected = !!displayName && !!devicePlatform;
  const createDisabled = loading || !displayName || !selectedSystemName;

  const systemImagesOptions =
    platformSelected && devicePlatform === "ios"
      ? iOSRuntimes.map((runtime) => ({
          value: runtime.identifier,
          label: runtime.name,
          disabled: !runtime.available,
        }))
      : androidImages.map((systemImage) => ({
          value: systemImage.location,
          label: systemImage.name,
          disabled: !systemImage.available,
        }));

  async function createDevice() {
    if (!selectedSystemName) {
      return;
    }

    setLoading(true);
    try {
      if (devicePlatform === "ios" && Platform.OS === "macos") {
        const runtime = iOSRuntimes.find(({ identifier }) => identifier === selectedSystemName);
        if (!runtime) {
          return;
        }
        const iOSDeviceType = runtime.supportedDeviceTypes.find(({ name }) => name === displayName);
        if (!iOSDeviceType) {
          return;
        }
        await deviceManager.createIOSDevice(iOSDeviceType, runtime);
      } else {
        const systemImage = androidImages.find((image) => image.location === selectedSystemName);
        if (!systemImage || !displayName || !deviceName) {
          return;
        }
        await deviceManager.createAndroidDevice(displayName, deviceName, systemImage);
      }
    } finally {
      onCreate();
    }
  }

  return (
    <div className="edit-device-form">
      <div className="form-row">
        <Label>Device Type</Label>
        <Select
          className="form-field"
          value={`${devicePlatform && displayName ? `${devicePlatform}:${displayName}:${deviceName}` : ""}`}
          onChange={(newValue: string) => {
            const [newPlatform, newDisplayName, newDeviceName] = newValue.split(":", 3);
            assertPlatform(newPlatform);
            setDisplayName(newDisplayName);
            setDeviceName(newDeviceName);
            setDevicePlatform(newPlatform);
            selectSystemName(undefined);
          }}
          items={supportedDevices}
          placeholder="Choose device type..."
        />
      </div>
      <div className="form-row">
        <Label>
          <span>System image</span>
          {systemImagesOptions.length === 0 && <span className="codicon codicon-warning warning" />}
        </Label>
        <div className="form-label" />
        {systemImagesOptions.length > 0 ? (
          <Select
            disabled={!platformSelected}
            className="form-field"
            value={selectedSystemName ?? ""}
            onChange={(newValue) => selectSystemName(newValue)}
            items={systemImagesOptions}
            placeholder="Select device system image..."
          />
        ) : (
          <div>
            No system images found. You can install them using{" "}
            {devicePlatform === "ios" ? "Xcode" : "Android Studio"}.
          </div>
        )}
      </div>
      <div className="button-panel">
        <Button onClick={onCancel} type="secondary">
          Cancel
        </Button>
        <Button disabled={createDisabled} onClick={createDevice} type="ternary">
          Create
        </Button>
      </div>
    </div>
  );
}

export default CreateDeviceView;
