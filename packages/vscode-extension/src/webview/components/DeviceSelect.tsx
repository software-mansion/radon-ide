import _ from "lodash";
import React, { PropsWithChildren } from "react";
import * as Select from "@radix-ui/react-select";
import { use$ } from "@legendapp/state/react";
import "./DeviceSelect.css";
import "./shared/Dropdown.css";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import ManageDevicesView from "../views/ManageDevicesView";
import RichSelectItem from "./shared/RichSelectItem";
import { VscodeBadge as Badge } from "@vscode-elements/react-elements";
import { useStore } from "../providers/storeProvider";
import { DeviceInfo, DevicePlatform } from "../../common/State";

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
          data-test={`device-${device.displayName}`}
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
  const store$ = useStore();
  const stopPreviousDevices = use$(store$.workspaceConfiguration.stopPreviousDevices);

  const { selectedDeviceSession, projectState, project } = useProject();

  const devices = use$(store$.devicesState.devices) ?? [];
  const { openModal } = useModal();

  const selectedProjectDevice = selectedDeviceSession?.deviceInfo;

  const hasNoDevices = devices.length === 0;
  const selectedDevice = selectedDeviceSession?.deviceInfo;

  const radonConnectEnabled = projectState.connectState.enabled;

  const { deviceSessions } = projectState;
  const runningSessionIds = Object.keys(deviceSessions);

  const deviceSections = partitionDevices(devices ?? []);

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
      const deviceInfo = (devices ?? []).find((d) => d.id === value);
      if (deviceInfo) {
        project.startOrActivateSessionForDevice(deviceInfo, {
          stopPreviousDevices,
        });
      }
    }
  };

  const handleDeviceStop = (deviceId: string) => {
    project.terminateSession(deviceId);
  };

  const placeholderText = hasNoDevices ? "No devices found" : "Select device";
  const deviceNameOrPlaceholder = selectedDevice?.displayName ?? placeholderText;
  const backgroundDeviceCounter = runningSessionIds.length - (selectedDevice ? 1 : 0);

  const displayName = radonConnectEnabled ? "Radon Connect" : deviceNameOrPlaceholder;
  const iconClass = radonConnectEnabled ? "debug-disconnect" : "device-mobile";

  const value = radonConnectEnabled ? "connect" : (selectedDevice?.id ?? placeholderText);

  return (
    <Select.Root onValueChange={handleDeviceDropdownChange} value={value}>
      <Select.Trigger
        className="device-select-trigger"
        data-test="radon-bottom-bar-device-select-dropdown-trigger">
        <Select.Value>
          <div className="device-select-value">
            <span className={`codicon codicon-${iconClass}`} />
            <span className="device-select-value-text" data-test="device-select-value-text">
              {displayName}
            </span>
            {backgroundDeviceCounter > 0 && (
              <span className="device-select-counter">+{backgroundDeviceCounter}</span>
            )}
          </div>
        </Select.Value>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="device-select-content"
          data-test="device-select-menu"
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
            <SelectItem value="manage" data-test="device-select-menu-manage-devices-button">
              Manage devices...
            </SelectItem>
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
