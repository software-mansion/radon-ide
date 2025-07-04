import _ from "lodash";
import React, { PropsWithChildren } from "react";
import * as Select from "@radix-ui/react-select";
import { DeviceInfo, DevicePlatform } from "../../common/DeviceManager";
import "./DeviceSelect.css";
import "./shared/Dropdown.css";
import { useProject } from "../providers/ProjectProvider";
import { useDevices } from "../providers/DevicesProvider";
import { useModal } from "../providers/ModalProvider";
import ManageDevicesView from "../views/ManageDevicesView";
import RichSelectItem from "./shared/RichSelectItem";
import { useWorkspaceConfig } from "../providers/WorkspaceConfigProvider";
import { VscodeBadge as Badge } from "@vscode-elements/react-elements";

const SelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<Select.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => (
    <Select.Item className="device-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  )
);

function RunningBadgeButton({ onStopClick }: { onStopClick?: (e: React.MouseEvent) => void }) {
  return (
    <div
      onPointerUpCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={onStopClick}>
      <Badge variant="activity-bar-counter" className="running-badge-button">
        <span />
      </Badge>
    </div>
  );
}

function renderDevices(
  deviceLabel: string,
  devices: DeviceInfo[],
  selectedProjectDevice: DeviceInfo | undefined,
  runningSessionIds: string[],
  handleDeviceStop: (deviceId: string) => void
) {
  if (devices.length === 0) {
    return null;
  }

  function isRunning(deviceId: string) {
    return runningSessionIds.includes(deviceId);
  }

  return (
    <Select.Group>
      <Select.Label className="device-select-label">{deviceLabel}</Select.Label>
      {devices.map((device) => (
        <RichSelectItem
          value={device.id}
          key={device.id}
          icon={<span className="codicon codicon-device-mobile" />}
          title={device.displayName}
          subtitle={device.systemName}
          disabled={!device.available}
          isSelected={device.id === selectedProjectDevice?.id}>
          {isRunning(device.id) && (
            <RunningBadgeButton onStopClick={() => handleDeviceStop(device.id)} />
          )}
        </RichSelectItem>
      ))}
    </Select.Group>
  );
}

function partitionDevices(devices: DeviceInfo[]): Record<string, DeviceInfo[]> {
  const validDevices = devices.filter(({ modelId }) => modelId.length > 0);

  const [iosDevices, androidDevices] = _.partition(
    validDevices,
    ({ platform }) => platform === DevicePlatform.IOS
  );
  return {
    iOS: iosDevices,
    Android: androidDevices,
  };
}

function DeviceSelect() {
  const { selectedDeviceSession, projectState, project } = useProject();
  const { devices, deviceSessionsManager } = useDevices();
  const { openModal } = useModal();
  const { stopPreviousDevices } = useWorkspaceConfig();
  const selectedProjectDevice = selectedDeviceSession?.deviceInfo;

  const hasNoDevices = devices.length === 0;
  const selectedDevice = selectedDeviceSession?.deviceInfo;
  console.warn("STATETE", projectState);
  const radonConnectEnabled = projectState.connectState.enabled;

  const { deviceSessions } = projectState;
  const runningSessionIds = Object.keys(deviceSessions);

  const deviceSections = partitionDevices(devices);

  const handleDeviceDropdownChange = async (value: string) => {
    if (value === "manage") {
      openModal("Manage Devices", <ManageDevicesView />);
      return;
    }
    if (value === "connect") {
      project.enableRadonConnect();
      return;
    }
    if (selectedDevice?.id !== value) {
      const deviceInfo = devices.find((d) => d.id === value);
      if (deviceInfo) {
        deviceSessionsManager.startOrActivateSessionForDevice(deviceInfo, {
          stopPreviousDevices,
        });
      }
    }
  };

  const handleDeviceStop = (deviceId: string) => {
    deviceSessionsManager.terminateSession(deviceId);
  };

  const placeholderText = hasNoDevices ? "No devices found" : "Select device";
  const text = selectedDevice?.displayName ?? placeholderText;
  const backgroundDeviceCounter = runningSessionIds.length - (selectedDevice ? 1 : 0);

  const displayName = radonConnectEnabled ? "Radon Connect" : selectedDevice?.displayName;
  const iconClass = radonConnectEnabled ? "debug-disconnect" : "device-mobile";

  // NOTE: we use placeholder text as the value initially because passing `undefined` causes
  // issues with the "manage devices" option.
  // See https://github.com/software-mansion/radon-ide/pull/1231#pullrequestreview-2910304970
  const value = radonConnectEnabled ? "connect" : selectedDevice?.id;

  return (
    <Select.Root onValueChange={handleDeviceDropdownChange} value={value}>
      <Select.Trigger className="device-select-trigger" disabled={hasNoDevices}>
        <Select.Value>
          <div className="device-select-value">
            <span className={`codicon codicon-${iconClass}`} />
            <span className="device-select-value-text">{displayName}</span>
            {backgroundDeviceCounter > 0 && (
              <span className="device-select-counter">+{backgroundDeviceCounter}</span>
            )}
          </div>
        </Select.Value>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="device-select-content"
          position="popper"
          align="center"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <Select.ScrollUpButton className="device-select-scroll">
            <span className="codicon codicon-chevron-up" />
          </Select.ScrollUpButton>
          <Select.Viewport className="device-select-viewport">
            {Object.entries(deviceSections).map(([label, sectionDevices]) =>
              renderDevices(
                label,
                sectionDevices,
                selectedProjectDevice,
                runningSessionIds,
                handleDeviceStop
              )
            )}
            <Select.Separator className="device-select-separator" />
            <Select.Group>
              <RichSelectItem
                value="connect"
                icon={<span className="codicon codicon-debug-disconnect" />}
                title="Radon Connect"
                subtitle="Attach to own device/simulator"
                isSelected={radonConnectEnabled}
              />
            </Select.Group>
            <Select.Separator className="device-select-separator" />
            <SelectItem value="manage">Manage devices...</SelectItem>
          </Select.Viewport>
          <Select.ScrollDownButton className="device-select-scroll">
            <span className="codicon codicon-chevron-down" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default DeviceSelect;
