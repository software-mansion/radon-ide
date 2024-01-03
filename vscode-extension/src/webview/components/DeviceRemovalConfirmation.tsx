import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { Device, PLATFORM } from "../utilities/device";
import "./DeviceRemovalConfirmation.css";
import { useMemo } from "react";

function DeviceRemovalConfirmation({
  device,
  onConfirm,
}: {
  device: Device;
  onConfirm: (accepted: boolean) => void;
}) {
  const systemImageName = useMemo(() => {
    if (device.platform === PLATFORM.ANDROID && device.systemImage) {
      return ` (${device.systemImage.path}).`;
    } else if (device.platform === PLATFORM.IOS && device.runtime) {
      return ` (${device.runtime.name}).`;
    }
    return ".";
  }, [device]);

  return (
    <div>
      <h2>
        Are you sure you want to remove the <i>{device.name}</i> device?
      </h2>
      <div>
        <b>Important:</b> By removing the device, you are also removing the device system image
        {systemImageName}
      </div>
      <div className="button-group">
        <VSCodeButton className="confirmation-button" onClick={() => onConfirm(true)}>
          Yes
        </VSCodeButton>
        <VSCodeButton
          appearance="secondary"
          className="confirmation-button"
          onClick={() => onConfirm(false)}>
          No
        </VSCodeButton>
      </div>
    </div>
  );
}

export default DeviceRemovalConfirmation;
