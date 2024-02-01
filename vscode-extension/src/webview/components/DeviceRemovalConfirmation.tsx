import "./DeviceRemovalConfirmation.css";
import { DeviceInfo } from "../../common/DeviceManager";
import { useState } from "react";
import { useDevices } from "../providers/DevicesProvider";
import Button from "./shared/Button";

function DeviceRemovalConfirmation({
  deviceInfo,
  onClose,
}: {
  deviceInfo: DeviceInfo;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const { deviceManager } = useDevices();

  return (
    <div>
      <h2>
        Are you sure you want to remove the <i>{deviceInfo.name}</i> device?
      </h2>
      <div className="button-group">
        <Button
          className="confirmation-button"
          type="secondary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await deviceManager.removeDevice(deviceInfo);
            } finally {
              onClose();
            }
          }}>
          Yes
        </Button>
        <Button type="ternary" className="confirmation-button" disabled={loading} onClick={onClose}>
          No
        </Button>
      </div>
    </div>
  );
}

export default DeviceRemovalConfirmation;
