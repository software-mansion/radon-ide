import "./DeviceRenameDialog.css";
import { useEffect, useState } from "react";
import { DeviceInfo } from "../../common/DeviceManager";
import { useDevices } from "../providers/DevicesProvider";
import Button from "./shared/Button";
import { useModal } from "../providers/ModalProvider";
import { formatDeviceName, MAX_DEVICE_NAME_LENGTH } from "../views/CreateDeviceView";
import Label from "../components/shared/Label";
import { useProject } from "../providers/ProjectProvider";

function DeviceRenameDialog({
  deviceInfo,
  onClose,
}: {
  deviceInfo: DeviceInfo;
  onClose: () => void;
}) {
  const [deviceName, setDeviceName] = useState<string>(deviceInfo.deviceName);
  const [isDeviceNameValid, setIsDeviceNameValid] = useState(true);
  const { deviceManager } = useDevices();
  const { project } = useProject();

  const { showHeader } = useModal();
  useEffect(() => {
    showHeader(false);
    return () => {
      showHeader(true);
    };
  });

  const handleDeviceNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = formatDeviceName(event.target.value);
    setDeviceName(text);
    setIsDeviceNameValid(0 < text.length && text.length <= MAX_DEVICE_NAME_LENGTH);
  };

  return (
    <div>
      <div className="device-rename-title">Rename device</div>
      <div className="device-rename-wrapper">
        <Label>
          <span>New Name</span>
        </Label>
        <input
          value={deviceName}
          className="device-name-input"
          style={isDeviceNameValid ? {} : { border: "1px solid var(--red-light-100)" }}
          type="string"
          defaultValue={deviceInfo.deviceName}
          onChange={handleDeviceNameChange}
        />
        {!isDeviceNameValid && (
          <div className="submit-rejection-message">
            Make sure that the custom name is between 1 and {MAX_DEVICE_NAME_LENGTH} characters
            long.
          </div>
        )}
      </div>

      <div className="device-rename-button-group">
        <Button type="secondary" className="device-rename-button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="device-rename-button"
          type="ternary"
          disabled={!isDeviceNameValid}
          onClick={async () => {
            const newDeviceName = deviceName.trim();
            try {
              await deviceManager.renameDevice(deviceInfo, newDeviceName);
            } finally {
              deviceInfo.deviceName = newDeviceName;
              project.updateSelectedDevice(deviceInfo);
              onClose();
            }
          }}>
          Rename
        </Button>
      </div>
    </div>
  );
}

export default DeviceRenameDialog;
