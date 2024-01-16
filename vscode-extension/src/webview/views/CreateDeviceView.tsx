import Select from "../components/shared/Select";
import "./CreateDeviceView.css";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
import { useDevices } from "../providers/DevicesProvider";

enum SupportedAndroidPhone {
  PIXEL_7 = "Google Pixel 7",
}

enum SupportedIOSPhone {
  IPHONE_15_PRO = "iPhone 15 Pro",
}

type SupportedPhoneType = SupportedAndroidPhone | SupportedIOSPhone;

function isAndroidDeviceType(phone: SupportedPhoneType): phone is SupportedAndroidPhone {
  return Object.values(SupportedAndroidPhone).includes(phone as SupportedAndroidPhone);
}

function isIosDeviceType(phone: SupportedPhoneType): phone is SupportedIOSPhone {
  return Object.values(SupportedIOSPhone).includes(phone as SupportedIOSPhone);
}

const DEVICE_TYPE_OPTIONS = [
  {
    options: Object.values(SupportedIOSPhone).map((value) => ({ value, label: value })),
    label: "iOS",
  },
  {
    options: Object.values(SupportedAndroidPhone).map((value) => ({ value, label: value })),
    label: "Android",
  },
];

interface CreateDeviceViewProps {
  onCreate: () => void;
  onCancel: () => void;
}

function CreateDeviceView({ onCreate, onCancel }: CreateDeviceViewProps) {
  const [deviceType, setDeviceType] = useState<SupportedPhoneType | undefined>(undefined);
  const [selectedSystemValue, selectSystemValue] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  const { iOSRuntimes, androidImages, deviceManager } = useDevices();

  const systemImagesOptions =
    !!deviceType && isIosDeviceType(deviceType)
      ? iOSRuntimes.map((runtime) => ({
          value: runtime.identifier,
          label: runtime.name,
        }))
      : androidImages.map((systemImage) => ({
          value: systemImage.location,
          label: systemImage.name,
        }));

  const createDisabled = loading || !deviceType || !selectedSystemValue;

  async function createDevice() {
    if (!selectedSystemValue) {
      return;
    }
    try {
      setLoading(true);
      if (isIosDeviceType(deviceType!)) {
        const runtime = iOSRuntimes.find((runtime) => runtime.identifier === selectedSystemValue);
        if (!runtime) {
          return;
        }
        const iOSDeviceType = runtime.supportedDeviceTypes.find((dt) => dt.name === deviceType);
        if (!iOSDeviceType) {
          return;
        }
        const name = `${iOSDeviceType.name} – ${runtime.name}`;
        await deviceManager.createIOSDevice(iOSDeviceType.identifier, runtime.identifier, name);
      } else {
        const systemImage = androidImages.find((image) => image.location === selectedSystemValue);
        if (!systemImage) {
          return;
        }
        const name = `${deviceType} – ${systemImage.name}`;
        await deviceManager.createAndroidDevice(selectedSystemValue, name);
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
          value={deviceType}
          onChange={(newValue: string) => {
            setDeviceType(newValue as SupportedPhoneType);
            selectSystemValue(undefined);
          }}
          options={DEVICE_TYPE_OPTIONS}
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
            disabled={!deviceType}
            className="form-field"
            value={selectedSystemValue}
            onChange={(newValue) => selectSystemValue(newValue)}
            options={systemImagesOptions}
            placeholder={`Select device system image...`}
          />
        ) : (
          <div className="">
            No system images found. You can install them using{" "}
            {isIosDeviceType(deviceType!) ? "Xcode" : "Android Studio"}.
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
