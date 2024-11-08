import "./DeviceRenameDialog.css";
import { useEffect, useState } from "react";
import { DeviceInfo } from "../../common/DeviceManager";
import Button from "./shared/Button";
import { useModal } from "../providers/ModalProvider";
import { formatDisplayName, MAX_DEVICE_NAME_LENGTH } from "../views/CreateDeviceView";
import Label from "../components/shared/Label";
import { useProject } from "../providers/ProjectProvider";

function DeviceRenameDialog({
  deviceInfo,
  onClose,
}: {
  deviceInfo: DeviceInfo;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState<string>(deviceInfo.displayName);
  const [isDisplayNameValid, setIsDisplayNameValid] = useState(true);
  const { project } = useProject();

  const { showHeader } = useModal();
  useEffect(() => {
    showHeader(false);
    return () => {
      showHeader(true);
    };
  });

  const handleDisplayNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = formatDisplayName(event.target.value);
    setDisplayName(text);
    setIsDisplayNameValid(0 < text.length && text.length <= MAX_DEVICE_NAME_LENGTH);
  };

  return (
    <div>
      <div className="device-rename-title">Rename device</div>
      <div className="device-rename-wrapper">
        <Label>
          <span>New Name</span>
        </Label>
        <input
          value={displayName}
          className="device-name-input"
          style={isDisplayNameValid ? {} : { border: "1px solid var(--red-light-100)" }}
          type="string"
          onChange={handleDisplayNameChange}
        />
        {!isDisplayNameValid && (
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
          disabled={!isDisplayNameValid}
          onClick={async () => {
            const newDisplayName = displayName.trim();
            try {
              await project.renameDevice(deviceInfo, newDisplayName);
            } finally {
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
