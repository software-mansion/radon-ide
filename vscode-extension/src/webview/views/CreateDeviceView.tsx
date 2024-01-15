import Select from "../components/shared/Select";
import { useWorkspaceStateContext } from "../providers/WorkspaceStateProvider";
import { useSystemImagesContext } from "../providers/SystemImagesProvider";
import {
  SupportedIOSPhone,
  SupportedAndroidPhone,
  SupportedPhoneType,
  isIosDeviceType,
} from "../utilities/device";
import "./CreateDeviceView.css";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { useMemo, useState } from "react";
import { IosRuntime } from "../utilities/ios";
import { AndroidSystemImage, getVerboseAndroidImageName } from "../utilities/android";

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
  onCreate: (deviceType: SupportedPhoneType, systemImage: IosRuntime | AndroidSystemImage) => void;
  onCancel: () => void;
}

function CreateDeviceView({ onCreate, onCancel }: CreateDeviceViewProps) {
  const [deviceType, setDeviceType] = useState<SupportedPhoneType | undefined>(undefined);
  const [systemImageName, setSystemImageName] = useState<string | undefined>(undefined);

  const { installedIosRuntimes, installedAndroidImages } = useSystemImagesContext();

  const selectedSystemImage = useMemo(() => {
    if (!systemImageName || !deviceType) {
      return undefined;
    }
    if (isIosDeviceType(deviceType)) {
      return installedIosRuntimes.find((iOSRuntime) => iOSRuntime.name === systemImageName);
    }
    return installedAndroidImages.find(
      (androidSystemImage) => androidSystemImage.path === systemImageName
    );
  }, [systemImageName, installedAndroidImages, installedIosRuntimes, deviceType]);

  const systemImagesOptions = useMemo(() => {
    return !!deviceType && isIosDeviceType(deviceType)
      ? installedIosRuntimes.map((runtime) => ({
          value: runtime.name,
          label: runtime.name,
        }))
      : installedAndroidImages.map((systemImage) => ({
          value: systemImage.path,
          label: getVerboseAndroidImageName(systemImage),
        }));
  }, [installedAndroidImages, installedIosRuntimes, deviceType]);

  const createDisabled = !deviceType || !selectedSystemImage;

  return (
    <div className="edit-device-form">
      <div className="form-row">
        <div className="form-label">Device Type</div>
        <Select
          className="form-field"
          value={deviceType}
          onChange={(newValue: string) => setDeviceType(newValue as SupportedPhoneType)}
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
            value={systemImageName}
            onChange={(newValue) => setSystemImageName(newValue)}
            options={systemImagesOptions}
            placeholder={`Select device system image...`}
          />
        ) : (
          <div className="">
            No "System Images" found. You can install them using{" "}
            {isIosDeviceType(deviceType!) ? "Xcode" : "Android Studio"}.
          </div>
        )}
      </div>
      <div className="button-panel">
        <VSCodeButton onClick={onCancel} appearance="secondary">
          Cancel
        </VSCodeButton>
        <VSCodeButton
          disabled={createDisabled}
          onClick={() => onCreate(deviceType!, selectedSystemImage!)}>
          Create
        </VSCodeButton>
      </div>
    </div>
  );
}

export default CreateDeviceView;
