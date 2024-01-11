import IconButton from "../components/IconButton";
import Select from "../components/Select";
import { useGlobalStateContext } from "../providers/GlobalStateProvider";
import {
  AndroidSystemImage,
  IosRuntime,
  useSystemImagesContext,
} from "../providers/SystemImagesProvider";
import { PLATFORM } from "../utilities/device";
import "./CreateDeviceView.css";
import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useMemo, useState } from "react";
import Tooltip from "../components/Tooltip";

interface CreateDeviceViewProps {
  onCreate: (
    name: string,
    platform: PLATFORM,
    systemImage: IosRuntime | AndroidSystemImage
  ) => void;
  onCancel: () => void;
}

function CreateDeviceView({ onCreate, onCancel }: CreateDeviceViewProps) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState(PLATFORM.IOS);
  const [systemImageName, setSystemImageName] = useState<string | undefined>(undefined);
  const isIosDevice = platform === PLATFORM.IOS;

  const { installedIosRuntimes, installedAndroidImages } = useSystemImagesContext();
  const { devices } = useGlobalStateContext();

  const selectedSystemImage = useMemo(() => {
    if (!systemImageName) {
      return undefined;
    }
    if (platform === PLATFORM.IOS) {
      return installedIosRuntimes.find((iOSRuntime) => iOSRuntime.name === systemImageName);
    }
    return installedAndroidImages.find(
      (androidSystemImage) => androidSystemImage.path === systemImageName
    );
  }, [systemImageName, installedAndroidImages, installedIosRuntimes]);

  const systemImagesOptions = isIosDevice
    ? installedIosRuntimes.map((runtime) => ({
        value: runtime.name,
        label: runtime.name,
      }))
    : installedAndroidImages.map((systemImage) => ({
        value: systemImage.path,
        label: `${systemImage.apiLevel} - ${systemImage.description}`,
      }));

  const uniqueDeviceName = !devices.find((device) => device.name === name);
  const createDisabled = !name || !selectedSystemImage || !uniqueDeviceName;

  return (
    <div className="edit-device-form">
      <div className="form-row">
        <div className="form-label">Name</div>
        <VSCodeTextField
          className="form-field"
          type="text"
          placeholder="Enter device name"
          value={name}
          onInput={(e: any) => {
            setName(e.target.value);
          }}
        />
      </div>
      <div className="form-row">
        <div className="form-label">Platform</div>
        <Select
          className="form-field"
          value={platform}
          onChange={(newValue: string) => setPlatform(newValue as PLATFORM)}
          options={[
            { value: PLATFORM.IOS, label: PLATFORM.IOS },
            { value: PLATFORM.ANDROID, label: PLATFORM.ANDROID },
          ]}
          placeholder="Choose device platform..."
        />
      </div>
      <div className="form-row">
        <div className="form-label">
          <div>{isIosDevice ? "Runtime" : "System image"}</div>
          {!systemImagesOptions.length && <span className="codicon codicon-warning warning" />}
        </div>
        {!!systemImagesOptions.length ? (
          <Select
            className="form-field"
            value={systemImageName}
            onChange={(newValue) => setSystemImageName(newValue)}
            options={systemImagesOptions}
            placeholder={`Select device ${isIosDevice ? "runtime" : "system image"}...`}
          />
        ) : (
          <div className="">
            No {isIosDevice ? "Runtimes" : "System Images"} found. You can install them using{" "}
            {isIosDevice ? "Xcode" : "Android Studio"}.
          </div>
        )}
      </div>
      <div className="button-panel">
        <VSCodeButton onClick={onCancel} appearance="secondary">
          Cancel
        </VSCodeButton>
        <Tooltip
          label={!uniqueDeviceName ? "Some device with this name already exists." : undefined}>
          <VSCodeButton
            disabled={createDisabled}
            onClick={() => onCreate(name, platform, selectedSystemImage!)}>
            Create
          </VSCodeButton>
        </Tooltip>
      </div>
    </div>
  );
}

export default CreateDeviceView;
