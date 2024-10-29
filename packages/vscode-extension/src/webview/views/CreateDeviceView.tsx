import { useEffect, useState } from "react";
import Select from "../components/shared/Select";
import "./CreateDeviceView.css";
import { useDevices } from "../providers/DevicesProvider";
import Button from "../components/shared/Button";
import Label from "../components/shared/Label";
import {
  iOSSupportedDevices,
  AndroidSupportedDevices,
  DeviceProperties,
} from "../utilities/consts";
import { useDependencies } from "../providers/DependenciesProvider";
import { Platform } from "../providers/UtilsProvider";

interface CreateDeviceViewProps {
  onCreate: () => void;
  onCancel: () => void;
}

function useSupportedDevices() {
  const { errors } = useDependencies();

  return [
    Platform.select({
      macos: errors?.simulator
        ? { label: "iOS – error, check diagnostics", items: [] }
        : {
            label: "iOS",
            items: iOSSupportedDevices.map((device) => ({
              value: device.modelId,
              label: device.modelName,
            })),
          },
      windows: { label: "", items: [] },
    }),
    errors?.emulator
      ? { label: "Android – error, check diagnostics", items: [] }
      : {
          label: "Android",
          items: AndroidSupportedDevices.map((device) => ({
            value: device.modelId,
            label: device.modelName,
          })),
        },
  ];
}

export const MAX_DEVICE_NAME_LENGTH = 30;
export function formatDisplayName(name: string) {
  const singleSpaced = name.replace(/\s+/g, " ");
  return singleSpaced.replace(/[^a-zA-Z0-9 _-]/g, "");
}

function CreateDeviceView({ onCreate, onCancel }: CreateDeviceViewProps) {
  const [deviceProperties, setDeviceProperties] = useState<DeviceProperties | undefined>(undefined);
  const [selectedSystemName, selectSystemName] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [isDisplayNameValid, setIsDisplayNameValid] = useState(true);
  const [loading, setLoading] = useState<boolean>(false);

  const supportedDevices = useSupportedDevices();
  const { iOSRuntimes, androidImages, deviceManager, reload } = useDevices();

  useEffect(() => {
    reload();
  }, []);

  const createDisabled = loading || !deviceProperties || !selectedSystemName || !isDisplayNameValid;

  const systemImagesOptions =
    deviceProperties && deviceProperties.platform === "iOS"
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
    if (!deviceProperties || !selectedSystemName || !displayName) {
      return;
    }

    setLoading(true);
    try {
      if (deviceProperties && deviceProperties.platform === "iOS" && Platform.OS === "macos") {
        const runtime = iOSRuntimes.find(({ identifier }) => identifier === selectedSystemName);
        if (!runtime) {
          return;
        }
        const iOSDeviceType = runtime.supportedDeviceTypes.find(
          ({ identifier }) => identifier === deviceProperties.modelId
        );
        if (!iOSDeviceType) {
          return;
        }
        await deviceManager.createIOSDevice(iOSDeviceType, displayName.trim(), runtime);
      } else {
        const systemImage = androidImages.find((image) => image.location === selectedSystemName);
        if (!systemImage) {
          return;
        }
        await deviceManager.createAndroidDevice(
          deviceProperties.modelId,
          displayName.trim(),
          systemImage
        );
      }
    } finally {
      onCreate();
    }
  }

  const handleDisplayNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = formatDisplayName(event.target.value);
    setDisplayName(text);
    setIsDisplayNameValid(0 < text.length && text.length <= MAX_DEVICE_NAME_LENGTH);
  };

  function resetSystemAndDisplayNames() {
    selectSystemName("");
    setDisplayName("");
    setIsDisplayNameValid(true);
  }

  return (
    <div className="edit-device-form">
      <div className="form-row">
        <Label className="form-label">Device Type</Label>
        <Select
          className="form-field"
          value={deviceProperties?.modelId ?? ""}
          onChange={(modelId: string) => {
            const deviceProps = iOSSupportedDevices.concat(AndroidSupportedDevices).find((sd) => {
              return sd.modelId === modelId;
            });
            setDeviceProperties(deviceProps);
            resetSystemAndDisplayNames();
          }}
          items={supportedDevices}
          placeholder="Select device type..."
        />
      </div>
      <div className="form-row">
        <Label className="form-label">
          <span>System image</span>
          {systemImagesOptions.length === 0 && <span className="codicon codicon-warning warning" />}
        </Label>
        {systemImagesOptions.length > 0 ? (
          <Select
            disabled={!deviceProperties}
            className="form-field"
            value={selectedSystemName}
            onChange={(newValue) => {
              selectSystemName(newValue);
              setDisplayName(deviceProperties?.modelName ?? "");
            }}
            items={systemImagesOptions}
            placeholder="Select device system image..."
          />
        ) : (
          <div>
            No system images found. You can install them using{" "}
            {deviceProperties?.platform === "iOS" ? "Xcode" : "Android Studio"}.
          </div>
        )}
      </div>
      <div className="form-row">
        <Label className="form-label">
          <span>Name</span>
        </Label>
        <input
          value={displayName}
          className="device-name-input"
          style={isDisplayNameValid ? {} : { border: "1px solid var(--red-light-100)" }}
          type="string"
          onChange={handleDisplayNameChange}
          disabled={!selectedSystemName}
          placeholder="Enter device name..."
        />
      </div>
      {!isDisplayNameValid && (
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
