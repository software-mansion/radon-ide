import "./ManageDevicesView.css";
import { useEffect, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import IconButton from "../components/shared/IconButton";
import DeviceRenameDialog from "../components/DeviceRenameDialog";
import DeviceRemovalConfirmation from "../components/DeviceRemovalConfirmation";
import CreateDeviceView from "./CreateDeviceView";
import { DeviceInfo, DevicePlatform } from "../../common/DeviceManager";
import { useDevices } from "../providers/DevicesProvider";
import Tooltip from "../components/shared/Tooltip";
import Label from "../components/shared/Label";
import Button from "../components/shared/Button";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import { mapIdToModel } from "../utilities/deviceContants";
import { useWorkspaceConfig } from "../providers/WorkspaceConfigProvider";

import "../components/shared/SwitchGroup.css";

interface DeviceRowProps {
  deviceInfo: DeviceInfo;
  onDeviceRename: (device: DeviceInfo) => void;
  onDeviceDelete: (device: DeviceInfo) => void;
  isSelected: boolean;
  isRunning: boolean;
}

function DeviceRow({
  deviceInfo,
  onDeviceRename,
  onDeviceDelete,
  isSelected,
  isRunning,
}: DeviceRowProps) {
  const { deviceSessionsManager } = useDevices();
  const { preservePreviousDevice } = useWorkspaceConfig();

  const handleDeviceChange = async () => {
    if (!isSelected) {
      deviceSessionsManager.startOrActivateSessionForDevice(deviceInfo, {
        preservePreviousDevice,
      });
    }
  };
  const handleDeviceStop = async () => deviceSessionsManager.stopSession(deviceInfo.id);

  const deviceModelName = mapIdToModel(deviceInfo.modelId);
  const deviceSubtitle =
    deviceModelName !== deviceInfo.displayName
      ? `${deviceModelName} - ${deviceInfo.systemName}`
      : deviceInfo.systemName;

  const { closeModal } = useModal();
  return (
    <div className="device-row">
      <div className={isSelected ? "device-icon-selected" : "device-icon"}>
        {!deviceInfo.available ? (
          <Tooltip
            label="This device cannot be used. Perhaps the system image or runtime is missing. Try deleting and creating a new device instead."
            instant
            side="bottom">
            <span className="codicon codicon-warning warning" />
          </Tooltip>
        ) : (
          <span className="codicon codicon-device-mobile" />
        )}
      </div>
      <div className="device-label">
        <div className="device-title">
          {isSelected ? <b>{deviceInfo.displayName}</b> : deviceInfo.displayName}
        </div>
        <div className="device-subtitle">{deviceSubtitle}</div>
      </div>
      <span className="device-button-group">
        {!isSelected ? (
          isRunning ? (
            <IconButton
              tooltip={{
                label: "Stop device",
                side: "bottom",
                type: "secondary",
              }}
              onClick={async (e) => {
                e.stopPropagation();
                await handleDeviceStop();
              }}>
              <span className="codicon codicon-debug-stop" />
            </IconButton>
          ) : (
            <IconButton
              tooltip={{
                label: "Select device",
                side: "bottom",
                type: "secondary",
              }}
              disabled={!deviceInfo.available}
              onClick={async (e) => {
                e.stopPropagation();
                await handleDeviceChange();
                closeModal();
              }}>
              <span className="codicon codicon-play" />
            </IconButton>
          )
        ) : (
          <IconButton onClick={() => {}} disabled={true}>
            <span className="codicon codicon-blank" />
          </IconButton>
        )}
        <IconButton
          tooltip={{
            label: "Rename device",
            side: "bottom",
            type: "secondary",
          }}
          onClick={async (e) => {
            e.stopPropagation();
            onDeviceRename(deviceInfo);
          }}>
          <span className="codicon codicon-edit" />
        </IconButton>
        <IconButton
          tooltip={{
            label: `Remove device with its ${
              deviceInfo.platform === DevicePlatform.IOS ? "runtime" : "system image"
            }`,
            side: "bottom",
            type: "secondary",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDeviceDelete(deviceInfo);
          }}>
          <span className="codicon codicon-trash delete-icon" />
        </IconButton>
      </span>
    </div>
  );
}

function ManageDevicesView() {
  const { projectState, selectedDeviceSession } = useProject();
  const { deviceSessions } = projectState;
  const selectedProjectDevice = selectedDeviceSession?.deviceInfo;
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | undefined>(undefined);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [createDeviceViewOpen, setCreateDeviceViewOpen] = useState(false);

  const { preservePreviousDevice, update } = useWorkspaceConfig();

  const { devices, reload } = useDevices();

  useEffect(() => {
    reload();
  }, []);

  const iosDevices = devices.filter(
    ({ platform, modelId }) => platform === DevicePlatform.IOS && modelId.length > 0
  );
  const androidDevices = devices.filter(
    ({ platform, modelId }) => platform === DevicePlatform.Android && modelId.length > 0
  );

  const handleDeviceRename = (device: DeviceInfo) => {
    setSelectedDevice(device);
    setRenameDialogOpen(true);
  };

  const handleDeviceDelete = (device: DeviceInfo) => {
    setSelectedDevice(device);
    setDeleteConfirmationOpen(true);
  };

  const handleConfirmationClose = () => {
    setRenameDialogOpen(false);
    setDeleteConfirmationOpen(false);
    setSelectedDevice(undefined);
  };

  if (renameDialogOpen && selectedDevice) {
    return <DeviceRenameDialog deviceInfo={selectedDevice} onClose={handleConfirmationClose} />;
  }

  if (deleteConfirmationOpen && selectedDevice) {
    return (
      <DeviceRemovalConfirmation deviceInfo={selectedDevice} onClose={handleConfirmationClose} />
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

  function renderRow(deviceInfo: DeviceInfo) {
    return (
      <DeviceRow
        key={deviceInfo.id}
        deviceInfo={deviceInfo}
        onDeviceRename={handleDeviceRename}
        onDeviceDelete={handleDeviceDelete}
        isSelected={deviceInfo.id === selectedProjectDevice?.id}
        isRunning={Object.keys(deviceSessions).includes(deviceInfo.id)}
      />
    );
  }

  return (
    <div className="manage-devices-container">
      {iosDevices.length > 0 && (
        <>
          <Label>iOS Devices</Label>
          {iosDevices.map(renderRow)}
        </>
      )}
      {androidDevices.length > 0 && (
        <>
          <Label>Android Devices</Label>
          {androidDevices.map(renderRow)}
        </>
      )}
      <Button autoFocus className="create-button" onClick={() => setCreateDeviceViewOpen(true)}>
        <span className="codicon codicon-add" />
        <div className="create-button-text">Create new device</div>
      </Button>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          marginTop: "16px",
        }}>
        <label>Shut down devices when switching:</label>
        <Switch.Root
          className="switch-root small-switch"
          checked={!preservePreviousDevice}
          onCheckedChange={(checked) => update("preservePreviousDevice", !checked)}>
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
      </div>
    </div>
  );
}

export default ManageDevicesView;
