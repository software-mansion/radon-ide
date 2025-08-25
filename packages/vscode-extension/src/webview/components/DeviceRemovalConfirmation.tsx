import "./DeviceRemovalConfirmation.css";
import { useEffect, useState } from "react";
import Button from "./shared/Button";
import { useModal } from "../providers/ModalProvider";
import { DeviceInfo } from "../../common/State";
import { useProject } from "../providers/ProjectProvider";

function DeviceRemovalConfirmation({
  deviceInfo,
  onClose,
}: {
  deviceInfo: DeviceInfo;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const { project } = useProject();

  const { showHeader } = useModal();
  useEffect(() => {
    showHeader(false);
    return () => {
      showHeader(true);
    };
  }, []);

  return (
    <div className="device-removal-wrapper" data-test="device-removing-confirmation-view">
      <h2 className="device-removal-title">
        Are you sure you want to remove the <i>{deviceInfo.displayName}</i> device?
      </h2>
      <p className="device-removal-subtitle">This action cannot be undone.</p>
      <div className="device-removal-button-group">
        <Button
          type="secondary"
          className="device-removal-button"
          disabled={loading}
          onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="device-removal-button"
          dataTest="confirm-delete-device-button"
          type="ternary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await project.terminateSession(deviceInfo.id);
              await project.removeDevice(deviceInfo);
            } finally {
              onClose();
            }
          }}>
          Confirm
        </Button>
      </div>
    </div>
  );
}

export default DeviceRemovalConfirmation;
