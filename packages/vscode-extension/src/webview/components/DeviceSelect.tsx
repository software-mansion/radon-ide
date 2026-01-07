import _ from "lodash";
import React, { PropsWithChildren } from "react";
import * as Select from "@radix-ui/react-select";
import { use$ } from "@legendapp/state/react";
import { VscodeBadge as Badge } from "@vscode-elements/react-elements";
import "./DeviceSelect.css";
import "./shared/Dropdown.css";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import ManageDevicesView from "../views/ManageDevicesView";
import RichSelectItem from "./shared/RichSelectItem";
import { useStore } from "../providers/storeProvider";
import { DeviceInfo, DevicePlatform, DeviceType } from "../../common/State";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";
import { usePaywalledCallback } from "../hooks/usePaywalledCallback";
import { Feature, FeatureAvailabilityStatus } from "../../common/License";
import { useDevices } from "../hooks/useDevices";
import { PropsWithDataTest } from "../../common/types";
import { useFeatureAvailability } from "../hooks/useFeatureAvailability";

enum DeviceSection {
  IosSimulator = "IosSimulator",
  AndroidEmulator = "AndroidEmulator",
  PhysicalAndroid = "PhysicalAndroid",
}

const DeviceSectionLabels: Record<DeviceSection, string> = {
  PhysicalAndroid: "Connected Android Devices",
  AndroidEmulator: "Android Emulators",
  IosSimulator: "iOS",
} as const;

const SelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<Select.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => (
    <Select.Item className="device-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  )
);

function RunningBadgeButton({
  onStopClick,
  dataTest,
}: PropsWithDataTest<{
  onStopClick?: (e: React.MouseEvent) => void;
}>) {
  return (
    <div
      onPointerUpCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={onStopClick}>
      <Badge variant="activity-bar-counter" className="running-badge-button" data-testid={dataTest}>
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
          data-testid={`device-${device.displayName}`}
          subtitle={device.systemName}
          disabled={!device.available}
          isSelected={device.id === selectedProjectDevice?.id}>
          {isRunning(device.id) && (
            <RunningBadgeButton
              onStopClick={() => handleDeviceStop(device.id)}
              dataTest={`device-running-badge-${device.displayName}`}
            />
          )}
        </RichSelectItem>
      ))}
    </Select.Group>
  );
}

function DeviceSelect() {
  const store$ = useStore();
  const selectedDeviceSessionState = useSelectedDeviceSessionState();

  const { projectState, project } = useProject();

  const devicesByType = use$(store$.devicesState.devicesByType);
  const devices = useDevices(store$);

  const { openModal } = useModal();

  const hasNoDevices = devices.length === 0;
  const selectedDevice = use$(selectedDeviceSessionState.deviceInfo);
  const deviceSessions = use$(store$.projectState.deviceSessions);

  const radonConnectEnabled = projectState.connectState.enabled;

  const runningSessionIds = Object.keys(deviceSessions);

  function shouldShowDevice(device: DeviceInfo) {
    // NOTE: we hide disconnected physical devices in the dropdown, since they're not selectable anyway
    if (device.platform === DevicePlatform.Android && !device.emulator) {
      return device.available;
    }

    return true;
  }

  const deviceSections = {
    [DeviceSection.IosSimulator]: devicesByType.iosSimulators ?? [],
    [DeviceSection.AndroidEmulator]: devicesByType.androidEmulators ?? [],
    [DeviceSection.PhysicalAndroid]:
      devicesByType.androidPhysicalDevices?.filter(shouldShowDevice) ?? [],
  };

  const handleStartOrActivateSessionForIOSTabletDevice = usePaywalledCallback(
    async (deviceInfo: DeviceInfo) => {
      await project.startOrActivateSessionForDevice(deviceInfo);
    },
    Feature.IOSTabletSimulators,
    []
  );

  const handleStartOrActivateSessionForAndroidTabletEmulator = usePaywalledCallback(
    async (deviceInfo: DeviceInfo) => {
      await project.startOrActivateSessionForDevice(deviceInfo);
    },
    Feature.AndroidTabletEmulators,
    []
  );

  const handleStartOrActivateSessionForIOSSmartphoneDevice = usePaywalledCallback(
    async (deviceInfo: DeviceInfo) => {
      await project.startOrActivateSessionForDevice(deviceInfo);
    },
    Feature.IOSSmartphoneSimulators,
    []
  );

  const handleStartOrActivateSessionForAndroidSmartphoneEmulator = usePaywalledCallback(
    async (deviceInfo: DeviceInfo) => {
      await project.startOrActivateSessionForDevice(deviceInfo);
    },
    Feature.AndroidSmartphoneEmulators,
    []
  );

  const handleStartOrActivateSessionForAndroidPhysicalDevice = usePaywalledCallback(
    async (deviceInfo: DeviceInfo) => {
      await project.startOrActivateSessionForDevice(deviceInfo);
    },
    Feature.AndroidPhysicalDevice,
    []
  );

  const handleDeviceDropdownChange = async (value: string) => {
    if (value === "manage") {
      openModal(<ManageDevicesView />, { title: "Manage Devices" });
      return;
    }
    if (value === "connect") {
      project.enableRadonConnect();
      return;
    }
    if (selectedDevice?.id !== value) {
      const deviceInfo = (devices ?? []).find((d) => d.id === value);
      if (deviceInfo) {
        switch (deviceInfo.platform) {
          case DevicePlatform.IOS:
            if (deviceInfo.deviceType === DeviceType.Tablet) {
              await handleStartOrActivateSessionForIOSTabletDevice(deviceInfo);
              return;
            } else {
              await handleStartOrActivateSessionForIOSSmartphoneDevice(deviceInfo);
              return;
            }
          case DevicePlatform.Android:
            if (deviceInfo.deviceType === DeviceType.Tablet) {
              await handleStartOrActivateSessionForAndroidTabletEmulator(deviceInfo);
              return;
            } else if (deviceInfo.emulator === false) {
              handleStartOrActivateSessionForAndroidPhysicalDevice(deviceInfo);
              return;
            } else {
              await handleStartOrActivateSessionForAndroidSmartphoneEmulator(deviceInfo);
              return;
            }
        }
      }
    }
  };

  const isAdminDisabledDeviceSections = (section: DeviceSection): boolean => {
    const isRemoteAndroidAdminDisabled =
      useFeatureAvailability(Feature.AndroidPhysicalDevice) ===
      FeatureAvailabilityStatus.ADMIN_DISABLED;
    return !(section === DeviceSection.PhysicalAndroid && isRemoteAndroidAdminDisabled);
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
        data-testid="radon-bottom-bar-device-select-dropdown-trigger">
        <Select.Value>
          <div className="device-select-value">
            <span className={`codicon codicon-${iconClass}`} />
            <span className="device-select-value-text" data-testid="device-select-value-text">
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
          data-testid="device-select-menu"
          position="popper"
          align="center"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <Select.ScrollUpButton className="device-select-scroll">
            <span className="codicon codicon-chevron-up" />
          </Select.ScrollUpButton>
          <Select.Viewport className="device-select-viewport">
            {Object.values(DeviceSection)
              .filter(isAdminDisabledDeviceSections)
              .map((section) =>
                renderDevices(
                  DeviceSectionLabels[section],
                  deviceSections[section],
                  selectedDevice,
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
            <SelectItem value="manage" data-testid="device-select-menu-manage-devices-button">
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
