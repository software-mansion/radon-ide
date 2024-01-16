import "./ManageDevicesView.css";
import { useState } from "react";
import IconButton from "../components/shared/IconButton";
import DeviceRemovalConfirmation from "../components/DeviceRemovalConfirmation";
import CreateDeviceView from "./CreateDeviceView";
import { DeviceInfo, Platform } from "../../common/DeviceManager";
import { useDevices } from "../providers/DevicesProvider";
import Tooltip from "../components/shared/Tooltip";

interface DeviceRowProps {
  deviceInfo: DeviceInfo;
  onDeviceDelete: (device: DeviceInfo) => void;
}

function DeviceRow({ deviceInfo, onDeviceDelete }: DeviceRowProps) {
  return (
    <div className="device-row">
      <div className="device-label-row">
        <div className="device-label">
          <span className="codicon codicon-device-mobile" />
          {!deviceInfo.available && (
            <Tooltip
              label={`This device cannot be used. Perhaps the system image or runtime is missing. Try deleting and creating a new device instead.`}
              side={"bottom"}>
              <span className="codicon codicon-warning warning" />
            </Tooltip>
          )}
          {deviceInfo.name}
        </div>
      </div>
      <IconButton
        tooltip={{
          label: `Remove device with it's ${
            deviceInfo.platform === Platform.IOS ? "runtime." : "system image."
          }`,
          side: "bottom",
        }}
        onClick={() => onDeviceDelete(deviceInfo)}>
        <span className="codicon codicon-trash delete-icon" />
      </IconButton>
    </div>
  );
}

function ManageDevicesView() {
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | undefined>(undefined);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [createDeviceViewOpen, setCreateDeviceViewOpen] = useState(false);

  const { devices } = useDevices();

  const androidDevices = devices.filter((device) => device.platform === Platform.Android);
  const iosDevices = devices.filter((device) => device.platform === Platform.IOS);

  const handleDeviceDelete = (device: DeviceInfo) => {
    setSelectedDevice(device);
    setDeleteConfirmationOpen(true);
  };

  if (deleteConfirmationOpen && selectedDevice) {
    return (
      <DeviceRemovalConfirmation
        deviceInfo={selectedDevice}
        onClose={() => setDeleteConfirmationOpen(false)}
      />
    );
  }

  if (createDeviceViewOpen) {
    return (
      <CreateDeviceView
        onCancel={() => setCreateDeviceViewOpen(false)}
        onCreate={() => setCreateDeviceViewOpen(false)}
      />
    );
  }

  return (
    <div className="container">
      <IconButton className="create-button" onClick={() => setCreateDeviceViewOpen(true)}>
        <span className="codicon codicon-add" />
        <div className="create-button-text">Create new device</div>
      </IconButton>
      {!!iosDevices.length && (
        <>
          <div className="platform-header">iOS Devices</div>
          {iosDevices.map((deviceInfo) => (
            <DeviceRow
              key={deviceInfo.id}
              deviceInfo={deviceInfo}
              onDeviceDelete={handleDeviceDelete}
            />
          ))}
        </>
      )}
      {!!iosDevices.length && !!androidDevices.length && (
        <div className="platform-section-separator" />
      )}
      {!!androidDevices.length && (
        <>
          <div className="platform-header">Android Devices</div>
          {androidDevices.map((deviceInfo) => (
            <DeviceRow
              key={deviceInfo.id}
              deviceInfo={deviceInfo}
              onDeviceDelete={handleDeviceDelete}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default ManageDevicesView;
