import "./DeviceRenameDialog.css";
import { useEffect, useState, useRef } from "react";
import { DeviceInfo } from "../../common/DeviceManager";
import { useDevices } from "../providers/DevicesProvider";
import Button from "./shared/Button";
import { useModal } from "../providers/ModalProvider";
import { formatDisplayName, MAX_DISPLAY_NAME_LENGTH } from "../views/CreateDeviceView";
import Label from "../components/shared/Label";
import { useProject } from "../providers/ProjectProvider";

function DeviceRenameDialog({
  deviceInfo,
  onClose,
}: {
  deviceInfo: DeviceInfo;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDisplayNameValid, setIsDisplayNameValid] = useState(true);
  const { deviceManager } = useDevices();
  const { project } = useProject();

  const { showHeader } = useModal();
  useEffect(() => {
    showHeader(false);
    return () => {
      showHeader(true);
    };
  });

  const handleDisplayNameChange = () => {
    const displayName = inputRef.current!.value;
    inputRef.current!.value = formatDisplayName(displayName);
    setIsDisplayNameValid(0 < displayName.length && displayName.length <= MAX_DISPLAY_NAME_LENGTH);
  };

  return (
    <div>
      <div className="device-rename-title">Rename device</div>
      <div className="device-rename-wrapper">
        <Label>
          <span>New Name</span>
        </Label>
        <input
          ref={inputRef}
          className="display-name-input"
          style={isDisplayNameValid ? {} : { border: "1px solid var(--red-light-100)" }}
          type="string"
          defaultValue={deviceInfo.name}
          onChange={handleDisplayNameChange}
        />
        {!isDisplayNameValid && (
          <div className="submit-rejection-message">
            Make sure that the custom name is between 1 and {MAX_DISPLAY_NAME_LENGTH} characters
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
          disabled={!isDisplayNameValid}
          onClick={async () => {
            const newDisplayName = inputRef.current!.value;
            try {
              await deviceManager.renameDevice(deviceInfo, newDisplayName);
            } finally {
              deviceInfo.name = newDisplayName;
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
