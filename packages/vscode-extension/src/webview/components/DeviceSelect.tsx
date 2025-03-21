import React, { PropsWithChildren } from "react";
import * as Select from "@radix-ui/react-select";
import { DeviceInfo, DevicePlatform } from "../../common/DeviceManager";
import "./DeviceSelect.css";
import "./shared/Dropdown.css";
import Tooltip from "./shared/Tooltip";
import { useProject } from "../providers/ProjectProvider";
import { useDevices } from "../providers/DevicesProvider";
import { useModal } from "../providers/ModalProvider";
import ManageDevicesView from "../views/ManageDevicesView";

const SelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<Select.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => (
    <Select.Item className="device-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  )
);

interface RichSelectItemProps extends Select.SelectItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isSelected?: boolean;
}

const RichSelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<RichSelectItemProps>>(
  ({ children, icon, title, subtitle, isSelected, ...props }, forwardedRef) => {
    function renderSubtitle() {
      if (!subtitle) {
        return null;
      }

      const subtitleComponent = <div className="device-select-rich-item-subtitle">{subtitle}</div>;
      const isLongText = subtitle.length > 20;

      if (isLongText) {
        <Tooltip label={subtitle} side="right" instant>
          {subtitleComponent}
        </Tooltip>;
      }
      return subtitleComponent;
    }

    return (
      <Select.Item className="device-select-rich-item" {...props} ref={forwardedRef}>
        <div
          className={
            isSelected ? "device-select-rich-item-icon-selected" : "device-select-rich-item-icon"
          }>
          {icon}
        </div>
        <div>
          {isSelected ? (
            <div className="device-select-rich-item-title">
              <b>{title}</b>
            </div>
          ) : (
            <div className="device-select-rich-item-title">{title}</div>
          )}

          {renderSubtitle()}
        </div>
      </Select.Item>
    );
  }
);

function renderDevices(
  deviceType: DevicePlatform,
  devices: DeviceInfo[],
  selectedProjectDevice?: DeviceInfo
) {
  if (devices.length === 0) {
    return null;
  }

  const deviceLabel = deviceType === DevicePlatform.IOS ? "iOS" : "Android";
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

function DeviceSelect() {
  const { projectState, project } = useProject();
  const { devices } = useDevices();
  const { openModal } = useModal();
  const selectedProjectDevice = projectState?.selectedDevice;

  const hasNoDevices = devices.length === 0;
  const selectedDevice = projectState.selectedDevice;

  const iosDevices = devices.filter(
    ({ platform, modelId }) => platform === DevicePlatform.IOS && modelId.length > 0
  );
  const androidDevices = devices.filter(
    ({ platform, modelId }) => platform === DevicePlatform.Android && modelId.length > 0
  );

  const handleDeviceDropdownChange = async (value: string) => {
    if (value === "manage") {
      openModal("Manage Devices", <ManageDevicesView />);
      return;
    }
    if (selectedDevice?.id !== value) {
      const deviceInfo = devices.find((d) => d.id === value);
      if (deviceInfo) {
        project.selectDevice(deviceInfo);
      }
    }
  };

  return (
    <Select.Root
      onValueChange={handleDeviceDropdownChange}
      value={hasNoDevices ? undefined : selectedDevice?.id}>
      <Select.Trigger className="device-select-trigger" disabled={hasNoDevices}>
        <Select.Value placeholder="No devices found">
          <div className="device-select-value">
            <span className="codicon codicon-device-mobile" />
            {selectedDevice?.displayName}
          </div>
        </Select.Value>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="device-select-content"
          position="popper"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <Select.ScrollUpButton className="device-select-scroll">
            <span className="codicon codicon-chevron-up" />
          </Select.ScrollUpButton>
          <Select.Viewport className="device-select-viewport">
            {renderDevices(DevicePlatform.IOS, iosDevices, selectedProjectDevice)}
            {renderDevices(DevicePlatform.Android, androidDevices, selectedProjectDevice)}
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
