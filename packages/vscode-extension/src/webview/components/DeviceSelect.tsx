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

const SelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<Select.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => (
    <Select.Item className="device-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  )
);

function renderDevices(
  deviceLabel: string,
  devices: DeviceInfo[],
  selectedProjectDevice?: DeviceInfo
) {
  if (devices.length === 0) {
    return null;
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
          isSelected={device.id === selectedProjectDevice?.id}
        />
      ))}
    </Select.Group>
  );
}

function partitionDevices(
  devices: DeviceInfo[],
  runningSessionIds: string[],
  selectedDevice: DeviceInfo | undefined
): Record<string, DeviceInfo[]> {
  const validDevices = devices.filter(({ modelId }) => modelId.length > 0);

  let [runningDevices, stoppedDevices] = _.partition(validDevices, ({ id }) =>
    runningSessionIds.includes(id)
  );

  if (selectedDevice) {
    // If there's only a single selected, running device, we don't place it in a separate section.
    if (runningDevices.length <= 1) {
      stoppedDevices = validDevices;
      runningDevices = [];
    } else {
      // move the selected device to the top of the running devices list
      const selectedDeviceIdx = runningDevices.findIndex(({ id }) => id === selectedDevice.id);
      console.assert(selectedDeviceIdx !== -1, "Selected device must be running");
      runningDevices.splice(selectedDeviceIdx, 1);
      runningDevices.unshift(selectedDevice);
    }
  }

  const [iosDevices, androidDevices] = _.partition(
    stoppedDevices,
    ({ platform }) => platform === DevicePlatform.IOS
  );
  return {
    "Running devices": runningDevices,
    "iOS": iosDevices,
    "Android": androidDevices,
  };
}

function DeviceSelect() {
  const { selectedDeviceSession, projectState } = useProject();
  const { devices, deviceSessionsManager } = useDevices();
  const { openModal } = useModal();
  const { stopPreviousDevices } = useWorkspaceConfig();
  const selectedProjectDevice = selectedDeviceSession?.deviceInfo;

  const hasNoDevices = devices.length === 0;
  const selectedDevice = selectedDeviceSession?.deviceInfo;

  const { deviceSessions } = projectState;
  const runningSessionIds = Object.keys(deviceSessions);

  const deviceSections = partitionDevices(devices, runningSessionIds, selectedDevice);

  const handleDeviceDropdownChange = async (value: string) => {
    if (value === "manage") {
      openModal("Manage Devices", <ManageDevicesView />);
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

  const placeholderText = hasNoDevices ? "No devices found" : "Select device";
  const text = selectedDevice?.displayName ?? placeholderText;
  const backgroundDeviceCounter = runningSessionIds.length - (selectedDevice ? 1 : 0);

  return (
    <Select.Root
      onValueChange={handleDeviceDropdownChange}
      // NOTE: we pass the placeholder text as the value because passing `undefined` causes
      // issues with the "manage devices" option.
      // See https://github.com/software-mansion/radon-ide/pull/1231#pullrequestreview-2910304970
      value={selectedDevice?.id ?? placeholderText}>
      <Select.Trigger className="device-select-trigger" disabled={hasNoDevices}>
        <Select.Value>
          <div className="device-select-value">
            <span className="codicon codicon-device-mobile" />
            <span className="device-select-value-text">{text}</span>
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
              renderDevices(label, sectionDevices, selectedProjectDevice)
            )}
            {devices.length > 0 && <Select.Separator className="device-select-separator" />}
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
