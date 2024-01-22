import Select from "../components/shared/Select";
import "./CreateDeviceView.css";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
import { useDevices } from "../providers/DevicesProvider";

enum SupportedAndroidDevice {
  PIXEL_7 = "Google Pixel 7",
}

enum SupportedIOSDevice {
  IPHONE_15_PRO = "iPhone 15 Pro",
}

type SupportedDevice = SupportedAndroidDevice | SupportedIOSDevice;

function isSupportedAndroidDevice(device: SupportedDevice): device is SupportedAndroidDevice {
  return Object.values(SupportedAndroidDevice).includes(device as SupportedAndroidDevice);
}

function isSupportedIOSDevice(device: SupportedDevice): device is SupportedIOSDevice {
  return Object.values(SupportedIOSDevice).includes(device as SupportedIOSDevice);
}

const SUPPORTED_DEVICES = [
  {
    items: Object.values(SupportedIOSDevice).map((value) => ({ value, label: value })),
    label: "iOS",
  },
  {
    items: Object.values(SupportedAndroidDevice).map((value) => ({ value, label: value })),
    label: "Android",
  },
];

interface CreateDeviceViewProps {
  onCreate: () => void;
  onCancel: () => void;
}

function CreateDeviceView({ onCreate, onCancel }: CreateDeviceViewProps) {
  const [deviceName, setDeviceName] = useState<SupportedDevice | undefined>(undefined);
  const [selectedSystemName, selectSystemName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  const { iOSRuntimes, androidImages, deviceManager } = useDevices();

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
        <div className="form-label">Device Type</div>
        <Select
          className="form-field"
          value={deviceName}
          onChange={(newValue: string) => {
            setDeviceName(newValue as SupportedDevice);
            selectSystemName(undefined);
          }}
          items={SUPPORTED_DEVICES}
          placeholder="Choose device type..."
        />
      </div>
      <div className="form-row">
        <div className="form-label">
          <div>System image</div>
          {!systemImagesOptions.length && <span className="codicon codicon-warning warning" />}
        </div>
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
        <VSCodeButton onClick={onCancel} appearance="secondary">
          Cancel
        </VSCodeButton>
        <VSCodeButton disabled={createDisabled} onClick={createDevice}>
          Create
        </VSCodeButton>
      </div>
    </div>
  );
}

export default CreateDeviceView;
