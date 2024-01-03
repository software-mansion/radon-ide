import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { useGlobalStateContext } from "../providers/GlobalStateProvider";
import "./ManageDevicesView.css";
import { useEffect, useMemo, useState } from "react";
import IconButton from "../components/IconButton";
import DeviceRemovalConfirmation from "../components/DeviceRemovalConfirmation";
import { useSystemImagesContext } from "../providers/SystemImagesProvider";
import { Device, PLATFORM } from "../utilities/device";

function ManageDevicesView() {
  const { devices } = useGlobalStateContext();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const { installedAndroidImages, removeDeviceWithImage, isDeviceImageInstalled } =
    useSystemImagesContext();
  const { updateDevices } = useGlobalStateContext();

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId),
    [selectedDeviceId]
  );

  useEffect(() => {
    if (!selectedDevice && !!devices.length) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDevice]);

  const handleConfirmation = (isConfirmed: boolean) => {
    setDeleteConfirmationOpen(false);
    if (!isConfirmed) {
      return;
    }

    const filteredDevices = devices.filter((device) => device.id !== selectedDeviceId);
    updateDevices(filteredDevices);
    setSelectedDeviceId(filteredDevices[0]?.id);
    removeDeviceWithImage(selectedDevice!);
  };

  if (deleteConfirmationOpen && selectedDevice) {
    return <DeviceRemovalConfirmation device={selectedDevice} onConfirm={handleConfirmation} />;
  }

  return (
    <div className="container">
      <div className="top-bar">
        <VSCodeDropdown
          className="dropdown"
          positionAttribute="below"
          onChange={(e: any) => setSelectedDeviceId(e.target.value)}>
          {devices.map((device) => (
            <VSCodeOption
              className={`${isDeviceImageInstalled(device) ? "" : "missing-system-image-option"}`}
              key={device.id}
              value={device.id}>
              {device.name}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>
        {selectedDevice && (
          <IconButton
            onClick={() => setDeleteConfirmationOpen(true)}
            tooltip={{ label: `Remove ${selectedDevice.name} Device.`, side: "bottom" }}>
            <span className="codicon codicon-trash delete-icon" />
          </IconButton>
        )}
      </div>
      <div className="container">
        {!isDeviceImageInstalled(selectedDevice) && (
          <div className="non-exsiting-system-image-warning">
            <span className="codicon codicon-error error gap-right" />
            <div className="error">
              This device is unusable because{" "}
              {selectedDevice?.platform === PLATFORM.ANDROID && !selectedDevice?.systemImage
                ? "the device is missing the system image."
                : "the system image of the device is missing."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageDevicesView;
