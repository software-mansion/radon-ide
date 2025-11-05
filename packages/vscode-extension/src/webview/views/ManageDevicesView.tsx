import "./ManageDevicesView.css";
import { MouseEventHandler, useEffect, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { use$ } from "@legendapp/state/react";
import _ from "lodash";
import classNames from "classnames";
import IconButton from "../components/shared/IconButton";
import DeviceRenameDialog from "../components/DeviceRenameDialog";
import DeviceRemovalConfirmation from "../components/DeviceRemovalConfirmation";
import CreateDeviceView from "./CreateDeviceView";
import Tooltip from "../components/shared/Tooltip";
import Label from "../components/shared/Label";
import Button from "../components/shared/Button";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import { mapIdToModel } from "../utilities/deviceConstants";

import "../components/shared/SwitchGroup.css";
import { useStore } from "../providers/storeProvider";
import { PropsWithDataTest } from "../../common/types";
import { DeviceInfo, DevicePlatform } from "../../common/State";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";

interface DeviceRowProps {
  deviceInfo: DeviceInfo;
  onDeviceRename: (device: DeviceInfo) => void;
  onDeviceDelete: (device: DeviceInfo) => void;
  isSelected: boolean;
  isRunning: boolean;
  dataTest?: string;
}

function DeviceRow({
  deviceInfo,
  onDeviceRename,
  onDeviceDelete,
  isSelected,
  isRunning,
  dataTest,
}: PropsWithDataTest<DeviceRowProps>) {
  const { project } = useProject();
  const { closeModal } = useModal();

  const stopDevice = () => project.terminateSession(deviceInfo.id);
  const selectDevice: MouseEventHandler = (e) => {
    if (!isSelected) {
      e.stopPropagation();
      project.startOrActivateSessionForDevice(deviceInfo);
      closeModal();
    }
  };
  const isPhysicalDevice = deviceInfo.platform === DevicePlatform.Android && !deviceInfo.emulator;

  const deviceModelName = mapIdToModel(deviceInfo.modelId) ?? deviceInfo.displayName;
  const deviceSubtitle = (() => {
    if (isPhysicalDevice) {
      return deviceInfo.available ? "Connected" : "Disconnected";
    }

    return deviceModelName !== deviceInfo.displayName
      ? `${deviceModelName} - ${deviceInfo.systemName}`
      : deviceInfo.systemName;
  })();

  const renameTooltipLabel = isPhysicalDevice
    ? "Renaming physical devices is not supported"
    : "Rename device";

  const removeTooltipLabel =
    deviceInfo.platform === DevicePlatform.IOS
      ? "Remove device with its runtime"
      : !isPhysicalDevice
        ? "Remove device with its system image"
        : "Removing physical devices is not supported";

  const disabled = !deviceInfo.available || (isPhysicalDevice && !deviceInfo.available);

  return (
    <button
      className="device-row"
      disabled={disabled}
      onClick={selectDevice}
      data-selected={isSelected}
      data-testid={dataTest}>
      <div className={isSelected ? "device-icon-selected" : "device-icon"}>
        {isPhysicalDevice && !deviceInfo.available ? (
          <span className="codicon codicon-debug-disconnect" />
        ) : !deviceInfo.available ? (
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
        <div className="device-subtitle" title={deviceSubtitle}>
          {deviceSubtitle}
        </div>
      </div>
      <span className="device-button-group">
        {isRunning ? (
          <IconButton
            tooltip={{
              label: "Stop device",
              side: "bottom",
              type: "secondary",
            }}
            onClick={(e) => {
              e.stopPropagation();
              stopDevice();
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
            disabled={disabled}
            dataTest={`device-row-start-button-device-${deviceInfo.displayName}`}
            onClick={selectDevice}>
            <span className="codicon codicon-play" />
          </IconButton>
        )}
        <IconButton
          tooltip={{
            label: renameTooltipLabel,
            side: "bottom",
            type: "secondary",
          }}
          shouldDisplayLabelWhileDisabled
          disabled={isPhysicalDevice}
          data-testid={`manage-devices-menu-rename-button-device-${deviceInfo.displayName}`}
          onClick={(e) => {
            e.stopPropagation();
            onDeviceRename(deviceInfo);
          }}>
          <span className="codicon codicon-edit" />
        </IconButton>
        <IconButton
          tooltip={{
            label: removeTooltipLabel,
            side: "bottom",
            type: "secondary",
          }}
          shouldDisplayLabelWhileDisabled
          disabled={isPhysicalDevice}
          data-testid={`manage-devices-menu-delete-button-device-${deviceInfo.displayName}`}
          onClick={(e) => {
            e.stopPropagation();
            onDeviceDelete(deviceInfo);
          }}>
          <span
            className={classNames("codicon", "codicon-trash", isPhysicalDevice || "delete-icon")}
          />
        </IconButton>
      </span>
    </button>
  );
}

function ManageDevicesView() {
  const { project } = useProject();

  const store$ = useStore();
  const selectedDeviceSessionState = useSelectedDeviceSessionState();
  const deviceSessions = use$(store$.projectState.deviceSessions);

  const stopPreviousDevices = use$(store$.workspaceConfiguration.deviceControl.stopPreviousDevices);

  const selectedProjectDevice = use$(selectedDeviceSessionState.deviceInfo);

  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | undefined>(undefined);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [createDeviceViewOpen, setCreateDeviceViewOpen] = useState(false);

  const devicesByType = use$(store$.devicesState.devicesByType);

  const iosDevices = devicesByType?.iosSimulators ?? [];
  const androidEmulatorDevices = devicesByType?.androidEmulators ?? [];
  const androidPhysicalDevices = devicesByType?.androidPhysicalDevices ?? [];

  useEffect(() => {
    project.loadInstalledImages();
  }, []);

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
        dataTest={`manage-devices-menu-row-device-${deviceInfo.displayName}--${deviceInfo.id}`}
        onDeviceRename={handleDeviceRename}
        onDeviceDelete={handleDeviceDelete}
        isSelected={deviceInfo.id === selectedProjectDevice?.id}
        isRunning={Object.keys(deviceSessions).includes(deviceInfo.id)}
      />
    );
  }

  return (
    <div className="manage-devices-container" data-testid="manage-devices-view">
      {iosDevices.length > 0 && (
        <>
          <Label>iOS Devices</Label>
          {iosDevices.map(renderRow)}
        </>
      )}
      {androidEmulatorDevices.length > 0 && (
        <>
          <Label>Android Emulators</Label>
          {androidEmulatorDevices.map(renderRow)}
        </>
      )}
      {androidPhysicalDevices.length > 0 && (
        <>
          <Label>Physical Android Devices</Label>
          {androidPhysicalDevices.map(renderRow)}
        </>
      )}
      <Button
        autoFocus
        className="create-button"
        dataTest="manage-devices-menu-create-new-device-button"
        onClick={() => setCreateDeviceViewOpen(true)}>
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
          checked={stopPreviousDevices}
          onCheckedChange={(checked) =>
            store$.workspaceConfiguration.deviceControl.stopPreviousDevices.set(checked)
          }>
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
      </div>
    </div>
  );
}

export default ManageDevicesView;
