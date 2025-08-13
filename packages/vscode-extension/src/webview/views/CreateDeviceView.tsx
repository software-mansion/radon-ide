import { useState } from "react";
import { use$ } from "@legendapp/state/react";
import classNames from "classnames";
import Select from "../components/shared/Select";
import "./CreateDeviceView.css";
import Button from "../components/shared/Button";
import Label from "../components/shared/Label";
import {
  iOSSupportedDevices,
  AndroidSupportedDevices,
  DeviceProperties,
} from "../utilities/deviceConstants";
import { Input } from "../components/shared/Input";
import { useDependencyErrors } from "../hooks/useDependencyErrors";
import { useStore } from "../providers/storeProvider";
import { Platform, useProject } from "../providers/ProjectProvider";

interface CreateDeviceViewProps {
  onCreate: () => void;
  onCancel: () => void;
}

function useSupportedDevices() {
  const store$ = useStore();
  const iOSRuntimes = use$(store$.devicesState.iOSRuntimes) ?? [];
  const errors = useDependencyErrors();

  return [
    Platform.select({
      macos: errors?.simulator
        ? { label: "iOS – error, check diagnostics", items: [] }
        : {
            label: "iOS",
            items: iOSSupportedDevices
              .filter((device) => {
                return iOSRuntimes.some((runtime) =>
                  runtime.supportedDeviceTypes.some((type) => type.identifier === device.modelId)
                );
              })
              .map((device) => ({
                value: device.modelId,
                label: device.modelName,
              })),
          },
      windows: { label: "", items: [] },
      linux: { label: "", items: [] },
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
  const [isSystemCompatible, setIsSystemCompatible] = useState(true);
  const [displayName, setDisplayName] = useState<string>("");
  const [isDisplayNameValid, setIsDisplayNameValid] = useState(true);
  const [loading, setLoading] = useState<boolean>(false);

  const supportedDevices = useSupportedDevices();

  const { project } = useProject();

  const store$ = useStore();
  const iOSRuntimes = use$(store$.devicesState.iOSRuntimes) ?? [];
  const androidImages = use$(store$.devicesState.androidImages) ?? [];

  const createDisabled = loading || !deviceProperties || !selectedSystemName || !isDisplayNameValid;

  const systemImagesOptions =
    deviceProperties && deviceProperties.platform === "iOS"
      ? iOSRuntimes.map((runtime) => ({
          value: runtime.identifier,
          label: runtime.name,
          disabled: !runtime.available,
          marked: runtime.supportedDeviceTypes.every((device) => {
            return deviceProperties.modelId !== device.identifier;
          }),
        }))
      : androidImages.map((systemImage) => ({
          value: systemImage.location,
          label: systemImage.name,
          disabled: !systemImage.available,
          marked: !!(
            deviceProperties?.minimumAndroidApiLevel &&
            deviceProperties.minimumAndroidApiLevel > systemImage.apiLevel
          ),
        }));
  async function createDevice() {
    if (!deviceProperties || !selectedSystemName || !displayName) {
      return;
    }

    setLoading(true);
    try {
      if (deviceProperties && deviceProperties.platform === "iOS" && Platform.OS === "macos") {
        if (!iOSRuntimes) {
          return;
        }
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
        await project.createIOSDevice(iOSDeviceType, displayName.trim(), runtime);
      } else {
        if (!androidImages) {
          return;
        }
        const systemImage = androidImages.find((image) => image.location === selectedSystemName);
        if (!systemImage) {
          return;
        }
        await project.createAndroidDevice(
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
    setIsSystemCompatible(true);
  }

  return (
    <div className="edit-device-form">
      <div className="form-row">
        <Label className="form-label">Device Type</Label>
        <Select
          className="form-field"
          dataTest="device-type-select"
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
            className={classNames(
              "form-field",
              isSystemCompatible ? undefined : "form-filed-marked"
            )}
            dataTest="system-image-select"
            value={selectedSystemName}
            onChange={(newValue) => {
              setIsSystemCompatible(
                !systemImagesOptions.find((option) => {
                  return option.value === newValue;
                })?.marked
              );
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
        {!isSystemCompatible && (
          <div className="incompatible-system-warning">
            <span className="codicon codicon-warning warning" />{" "}
            <div>This system image is not compatible with the selected device.</div>
          </div>
        )}
      </div>
      <div className="form-row">
        <Label className="form-label">
          <span>Name</span>
        </Label>
        <Input
          value={displayName}
          className="device-name-input"
          data-test="device-name-input"
          data-error={!isDisplayNameValid}
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
        <Button
          disabled={createDisabled}
          onClick={createDevice}
          type="ternary"
          dataTest="create-device-button">
          Create
        </Button>
      </div>
    </div>
  );
}

export default CreateDeviceView;
