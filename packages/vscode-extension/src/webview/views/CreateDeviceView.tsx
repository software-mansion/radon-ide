import Select from "../components/shared/Select";
import "./CreateDeviceView.css";
import { useState } from "react";
import { useDevices } from "../providers/DevicesProvider";
import Button from "../components/shared/Button";
import Label from "../components/shared/Label";
import { SupportedDeviceName, SupportedDevices } from "../utilities/consts";
import { Platform } from "../../common/DeviceManager";

function isSupportedIOSDevice(device: SupportedDeviceName): boolean {
  return SupportedDevices[device].platform === Platform.IOS;
}

const SUPPORTED_DEVICES = [
  {
    items: Object.entries(SupportedDevices)
      .filter((item) => {
        return item[1].platform === Platform.IOS;
      })
      .map((item) => ({ value: item[0], label: item[0] })),
    label: "iOS",
  },
  {
    items: Object.entries(SupportedDevices)
      .filter((item) => {
        return item[1].platform === Platform.Android;
      })
      .map((item) => ({ value: item[0], label: item[0] })),
    label: "Android",
  },
];

interface CreateDeviceViewProps {
  onCreate: () => void;
  onCancel: () => void;
}

function CreateDeviceView({ onCreate, onCancel }: CreateDeviceViewProps) {
  const [deviceName, setDeviceName] = useState<SupportedDeviceName | undefined>(undefined);
  const [selectedSystemName, selectSystemName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  const { iOSRuntimes, androidImages, deviceManager } = useDevices(true);

  const systemImagesOptions =
    !!deviceName && isSupportedIOSDevice(deviceName)
      ? iOSRuntimes.map((runtime) => ({
          value: runtime.identifier,
          label: runtime.name,
        }))
      : androidImages.map((systemImage) => ({
          value: systemImage.location,
          label: systemImage.name,
        }));

  const createDisabled = loading || !deviceName || !selectedSystemName;

  async function createDevice() {
    if (!selectedSystemName) {
      return;
    }
    try {
      setLoading(true);
      if (isSupportedIOSDevice(deviceName!)) {
        const runtime = iOSRuntimes.find((runtime) => runtime.identifier === selectedSystemName);
        if (!runtime) {
          return;
        }
        const iOSDeviceType = runtime.supportedDeviceTypes.find((dt) => dt.name === deviceName);
        console.log("Frytki", runtime.supportedDeviceTypes);
        if (!iOSDeviceType) {
          return;
        }
        await deviceManager.createIOSDevice(iOSDeviceType, runtime);
      } else {
        const systemImage = androidImages.find((image) => image.location === selectedSystemName);
        if (!systemImage || !deviceName) {
          return;
        }
        await deviceManager.createAndroidDevice(deviceName, systemImage);
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
          value={deviceName}
          onChange={(newValue: string) => {
            setDeviceName(newValue as SupportedDeviceName);
            selectSystemName(undefined);
          }}
          items={SUPPORTED_DEVICES}
          placeholder="Choose device type..."
        />
      </div>
      <div className="form-row">
        <Label>
          <span>System image</span>
          {!systemImagesOptions.length && <span className="codicon codicon-warning warning" />}
        </Label>
        <div className="form-label"></div>
        {!!systemImagesOptions.length ? (
          <Select
            disabled={!deviceName}
            className="form-field"
            value={selectedSystemName}
            onChange={(newValue) => selectSystemName(newValue)}
            items={systemImagesOptions}
            placeholder={`Select device system image...`}
          />
        ) : (
          <div className="">
            No system images found. You can install them using{" "}
            {isSupportedIOSDevice(deviceName!) ? "Xcode" : "Android Studio"}.
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
