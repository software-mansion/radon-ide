import { useEffect, useState } from "react";
import Select from "../components/shared/Select";
import "./CreateDeviceView.css";
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
    return { value: `${prefix}:${item.modelName}`, label: item.modelName };
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

export const MAX_DEVICE_NAME_LENGTH = 30;
export function formatDeviceName(name: string) {
  const singleSpaced = name.replace(/\s+/g, " ");
  return singleSpaced.replace(/[^a-zA-Z0-9 _-]/g, "");
}

function CreateDeviceView({ onCreate, onCancel }: CreateDeviceViewProps) {
  const [deviceModel, setDeviceModel] = useState<string | undefined>(undefined);
  const [devicePlatform, setDevicePlatform] = useState<"ios" | "android" | undefined>(undefined);
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined);
  const [selectedSystemName, selectSystemName] = useState<string | undefined>(undefined);
  const [isDeviceNameValid, setIsDeviceNameValid] = useState(true);
  const [loading, setLoading] = useState<boolean>(false);

  const supportedDevices = useSupportedDevices();
  const { iOSRuntimes, androidImages, deviceManager, reload } = useDevices();

  useEffect(() => {
    reload();
  }, []);

  const platformSelected = !!deviceModel && !!devicePlatform;
  const createDisabled = loading || !deviceModel || !selectedSystemName || !isDeviceNameValid;

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
        const iOSDeviceType = runtime.supportedDeviceTypes.find(({ name }) => name === deviceModel);
        if (!iOSDeviceType || !deviceModel || !deviceName) {
          return;
        }
        await deviceManager.createIOSDevice(deviceModel, deviceName.trim(), iOSDeviceType, runtime);
      } else {
        const systemImage = androidImages.find((image) => image.location === selectedSystemName);

        if (!systemImage || !deviceModel || !deviceName) {
          return;
        }
        await deviceManager.createAndroidDevice(deviceModel, deviceName.trim(), systemImage);
      }
    } finally {
      onCreate();
    }
  }

  const handleDeviceNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = formatDeviceName(event.target.value);
    setDeviceName(text);
    setIsDeviceNameValid(0 < text.length && text.length <= MAX_DEVICE_NAME_LENGTH);
  };

  return (
    <div className="edit-device-form">
      <div className="form-row">
        <Label>Device Type</Label>
        <Select
          className="form-field"
          value={`${devicePlatform && deviceModel ? `${devicePlatform}:${deviceModel}` : ""}`}
          onChange={(newValue: string) => {
            const [newPlatform, newModelName] = newValue.split(":", 2);
            assertPlatform(newPlatform);
            setDeviceModel(newModelName);
            setDevicePlatform(newPlatform);
            selectSystemName(undefined);
            setDeviceName("");
            setIsDeviceNameValid(true);
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
        {systemImagesOptions.length > 0 ? (
          <Select
            disabled={!platformSelected}
            className="form-field"
            value={selectedSystemName ?? ""}
            onChange={(newValue) => {
              selectSystemName(newValue);
              setDeviceName(deviceModel);
            }}
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
      <div className="form-row">
        <Label>
          <span>Name</span>
        </Label>
        <input
          value={deviceName}
          className="device-name-input"
          style={isDeviceNameValid ? {} : { border: "1px solid var(--red-light-100)" }}
          type="string"
          onChange={handleDeviceNameChange}
          disabled={!selectedSystemName}
        />
      </div>
      {!isDeviceNameValid && (
        <div className="submit-rejection-message">
          Make sure that the custom name is between 1 and {MAX_DEVICE_NAME_LENGTH} characters long.
        </div>
      )}
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
