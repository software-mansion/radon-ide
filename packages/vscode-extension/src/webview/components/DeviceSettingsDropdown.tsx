import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import { use$ } from "@legendapp/state/react";

import "./shared/Dropdown.css";
import "./shared/RadioGroup.css";
import "./shared/Slider.css";
import "./DeviceSettingsDropdown.css";
import "./shared/SwitchGroup.css";

import Label from "./shared/Label";
import { useProject } from "../providers/ProjectProvider";
import {
  AppPermissionType,
  DeviceRotationDirection,
  DeviceSettings,
  ProjectInterface,
} from "../../common/Project";
import { DeviceLocationView } from "../views/DeviceLocationView";
import { useModal } from "../providers/ModalProvider";
import { KeybindingInfo } from "./shared/KeybindingInfo";
import { DeviceLocalizationView } from "../views/DeviceLocalizationView";
import { OpenDeepLinkView } from "../views/OpenDeepLinkView";
import { CameraSettingsView } from "../views/CameraSettingsView";
import ReplayIcon from "./icons/ReplayIcon";
import { DropdownMenuRoot } from "./DropdownMenuRoot";
import { useStore } from "../providers/storeProvider";
import { DevicePlatform, DeviceRotation } from "../../common/State";

const contentSizes = [
  "xsmall",
  "small",
  "normal",
  "large",
  "xlarge",
  "xxlarge",
  "xxxlarge",
] as const;

interface DeviceSettingsDropdownProps {
  children: React.ReactNode;
  disabled?: boolean;
}

const resetOptionsIOS: Array<{ label: string; value: AppPermissionType; icon: string }> = [
  { label: "Reset All Permissions", value: "all", icon: "check-all" },
  { label: "Reset Location", value: "location", icon: "location" },
  { label: "Reset Photos", value: "photos", icon: "file-media" },
  { label: "Reset Contacts", value: "contacts", icon: "organization" },
  { label: "Reset Calendar", value: "calendar", icon: "calendar" },
];

const resetOptionsAndroid: Array<{ label: string; value: AppPermissionType; icon: string }> = [
  { label: "Reset All Permissions", value: "all", icon: "check-all" },
];

const setOrientationOptions: Array<{
  label: string;
  value: DeviceRotation;
  icon: string;
  rotation: string;
}> = [
  {
    label: "Portrait",
    value: DeviceRotation.Portrait,
    icon: "device-mobile",
    rotation: "0deg",
  },
  {
    label: "Landscape Left",
    value: DeviceRotation.LandscapeLeft,
    icon: "device-mobile",
    rotation: "-90deg",
  },
  {
    label: "Portait Upside Down",
    value: DeviceRotation.PortraitUpsideDown,
    icon: "device-mobile",
    rotation: "180deg",
  },
  {
    label: "Landscape Right",
    value: DeviceRotation.LandscapeRight,
    icon: "device-mobile",
    rotation: "90deg",
  },
];
const rotateOptions: Array<{
  label: string;
  value: DeviceRotationDirection;
  icon: string;
  commandName: string;
}> = [
  {
    label: "Clockwise",
    value: DeviceRotationDirection.Clockwise,
    icon: "refresh",
    commandName: "RNIDE.rotateDeviceClockwise",
  },
  {
    label: "Anticlockwise",
    value: DeviceRotationDirection.Anticlockwise,
    icon: "refresh mirror",
    commandName: "RNIDE.rotateDeviceAnticlockwise",
  },
];

function DeviceSettingsDropdown({ children, disabled }: DeviceSettingsDropdownProps) {
  const store$ = useStore();
  const showDeviceFrame = use$(store$.workspaceConfiguration.showDeviceFrame);
  const rotation = use$(store$.workspaceConfiguration.deviceRotation);

  const { project, selectedDeviceSession, deviceSettings } = useProject();

  const { openModal } = useModal();

  const resetOptions =
    selectedDeviceSession?.deviceInfo.platform === "iOS" ? resetOptionsIOS : resetOptionsAndroid;

  return (
    <DropdownMenuRoot>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-menu-content device-settings-content"
          data-test="device-settings-dropdown-menu"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <h4 className="device-settings-heading">Device Settings</h4>
          <form>
            <Label>Device appearance</Label>
            <RadioGroup.Root
              className="radio-group-root"
              defaultValue={deviceSettings.appearance}
              onValueChange={(value) => {
                project.updateDeviceSettings({
                  ...deviceSettings,
                  appearance: value as DeviceSettings["appearance"],
                });
              }}>
              <div className="radio-group-center">
                <RadioGroup.Item className="radio-group-item" value="light" id="r1">
                  <RadioGroup.Indicator className="radio-group-indicator" />
                </RadioGroup.Item>
                <label className="radio-group-label" htmlFor="r1">
                  Light
                </label>
              </div>
              <div className="radio-group-center">
                <RadioGroup.Item className="radio-group-item" value="dark" id="r2">
                  <RadioGroup.Indicator className="radio-group-indicator" />
                </RadioGroup.Item>
                <label className="radio-group-label" htmlFor="r2">
                  Dark
                </label>
              </div>
            </RadioGroup.Root>
            <div className="device-settings-margin" />
            <Label>Text size</Label>
            <div className="device-settings-center">
              <span className="device-settings-small-text-indicator" />
              <Slider.Root
                className="slider-root"
                defaultValue={[contentSizes.indexOf(deviceSettings.contentSize)]}
                max={6}
                step={1}
                onValueCommit={([value]) => {
                  project.updateDeviceSettings({
                    ...deviceSettings,
                    contentSize: contentSizes[value],
                  });
                }}>
                <Slider.Track className="slider-track">
                  <Slider.Range className="slider-range" />
                </Slider.Track>
                <Slider.Thumb className="slider-thumb" aria-label="Text Size" />
                <div className="slider-track-dent-container">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="slider-track-dent" />
                  ))}
                </div>
              </Slider.Root>
              <span className="device-settings-large-text-indicator" />
            </div>
            <div className="device-settings-margin" />
          </form>
          <CommandItem
            project={project}
            commandName="RNIDE.deviceHomeButtonPress"
            label="Press Home Button"
            icon="home"
          />
          <CommandItem
            project={project}
            commandName="RNIDE.deviceAppSwitchButtonPress"
            label="Open App Switcher"
            icon="chrome-restore"
          />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="dropdown-menu-item">
              <span className="codicon codicon-sync" />
              Rotate Device
              <span className="codicon codicon-chevron-right right-slot" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="dropdown-menu-subcontent"
                sideOffset={2}
                alignOffset={-5}>
                <Label>Rotate</Label>
                {rotateOptions.map((option) => (
                  <CommandItem
                    project={project}
                    commandName={option.commandName}
                    label={option.label}
                    icon={option.icon}
                  />
                ))}

                <div className="device-settings-margin" />
                <Label>Set Orientation</Label>

                {setOrientationOptions.map((option, index) => (
                  <DropdownMenu.Item
                    className="dropdown-menu-item"
                    key={index}
                    onSelect={() => store$.workspaceConfiguration.deviceRotation.set(option.value)}>
                    <span
                      className={`codicon codicon-${option.icon}`}
                      style={{ rotate: option.rotation }}
                    />
                    {option.label}
                    {rotation === option.value && (
                      <span className="codicon codicon-check right-slot" />
                    )}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          {selectedDeviceSession?.deviceInfo.platform === DevicePlatform.IOS && <BiometricsItem />}
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => project.openSendFileDialog()}>
            <span className="codicon codicon-share" />
            Send File
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              openModal("Location", <DeviceLocationView />);
            }}>
            <span className="codicon codicon-location" />
            Location
          </DropdownMenu.Item>
          <LocalizationItem />
          <VolumeItem />
          {selectedDeviceSession?.deviceInfo.platform === DevicePlatform.Android && <CameraItem />}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="dropdown-menu-item">
              <span className="codicon codicon-redo" />
              Reset Permissions
              <span className="codicon codicon-chevron-right right-slot" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="dropdown-menu-subcontent"
                sideOffset={2}
                alignOffset={-5}>
                {resetOptions.map((option, index) => (
                  <DropdownMenu.Item
                    className="dropdown-menu-item"
                    key={index}
                    onSelect={() => project.resetAppPermissions(option.value)}>
                    <span className={`codicon codicon-${option.icon}`} />
                    {option.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => openModal("Open Deep Link", <OpenDeepLinkView />)}>
            <span className="codicon codicon-link" />
            Open Deep Link
          </DropdownMenu.Item>
          <div className="dropdown-menu-item">
            <ReplayIcon />
            Enable Replays
            <Switch.Root
              className="switch-root small-switch"
              id="enable-replays"
              onCheckedChange={(checked) =>
                project.updateDeviceSettings({ ...deviceSettings, replaysEnabled: checked })
              }
              defaultChecked={deviceSettings.replaysEnabled}
              style={{ marginLeft: "auto" }}>
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
          <div className="dropdown-menu-item">
            <span className="codicon codicon-record" />
            Show Touches
            <Switch.Root
              className="switch-root small-switch"
              data-test="device-settings-show-touches-switch"
              id="show-touches"
              onCheckedChange={(checked) =>
                project.updateDeviceSettings({ ...deviceSettings, showTouches: checked })
              }
              defaultChecked={deviceSettings.showTouches}
              style={{ marginLeft: "auto" }}>
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
          <div className="dropdown-menu-item">
            <span className="codicon codicon-device-mobile" />
            Show Device Frame
            <Switch.Root
              className="switch-root small-switch"
              id="show-device-frame"
              onCheckedChange={(checked) =>
                store$.workspaceConfiguration.showDeviceFrame.set(checked)
              }
              defaultChecked={showDeviceFrame}
              style={{ marginLeft: "auto" }}>
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenuRoot>
  );
}

const LocalizationItem = () => {
  const { openModal } = useModal();
  return (
    <>
      <DropdownMenu.Item
        className="dropdown-menu-item"
        onSelect={() => {
          openModal("Localization", <DeviceLocalizationView />);
        }}>
        <span className="codicon codicon-globe" />
        Localization
      </DropdownMenu.Item>
    </>
  );
};

function CommandItem({
  project,
  commandName,
  label,
  icon,
  disabled = false,
}: {
  project: ProjectInterface;
  commandName: string;
  label: string;
  icon: string;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      className="dropdown-menu-item"
      onSelect={() => {
        project.runCommand(commandName);
      }}
      disabled={disabled}>
      <span className="dropdown-menu-item-wraper">
        <span className={`codicon codicon-${icon}`} />
        <div className="dropdown-menu-item-content">
          {label}
          <KeybindingInfo commandName={commandName} />
        </div>
      </span>
    </DropdownMenu.Item>
  );
}

const BiometricsItem = () => {
  const { project, deviceSettings } = useProject();

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="dropdown-menu-item">
        <span className="codicon codicon-layout" />
        Biometrics
        <span className="codicon codicon-chevron-right right-slot" />
      </DropdownMenu.SubTrigger>

      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="dropdown-menu-subcontent">
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              project.updateDeviceSettings({
                ...deviceSettings,
                hasEnrolledBiometrics: !deviceSettings.hasEnrolledBiometrics,
              });
            }}>
            <span className="codicon codicon-layout-sidebar-left" />
            Enrolled
            {deviceSettings.hasEnrolledBiometrics && (
              <span className="codicon codicon-check right-slot" />
            )}
          </DropdownMenu.Item>
          <CommandItem
            project={project}
            commandName="RNIDE.performBiometricAuthorization"
            label="Matching ID"
            icon="layout-sidebar-left"
            disabled={!deviceSettings.hasEnrolledBiometrics}
          />
          <CommandItem
            project={project}
            commandName="RNIDE.performFailedBiometricAuthorization"
            label="Non-Matching ID"
            icon="layout-sidebar-left"
            disabled={!deviceSettings.hasEnrolledBiometrics}
          />
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
};

const CameraItem = () => {
  const { openModal } = useModal();

  return (
    <DropdownMenu.Item
      className="dropdown-menu-item"
      onSelect={() => {
        openModal("Camera Settings", <CameraSettingsView />);
      }}>
      <span className="codicon codicon-device-camera" />
      Camera Settings
    </DropdownMenu.Item>
  );
};

const VolumeItem = () => {
  const { project } = useProject();

  const handleVolumeIncreaseDown = () => {
    project.dispatchButton("volumeUp", "Down");
  };

  const handleVolumeIncreaseUp = () => {
    project.dispatchButton("volumeUp", "Up");
  };

  const handleVolumeDecreaseDown = () => {
    project.dispatchButton("volumeDown", "Down");
  };

  const handleVolumeDecreaseUp = () => {
    project.dispatchButton("volumeDown", "Up");
  };

  // Make sure buttons get unpressed on unmount
  React.useEffect(() => {
    return () => {
      handleVolumeDecreaseUp();
      handleVolumeIncreaseUp();
    };
  }, []);

  return (
    <div className="dropdown-menu-item">
      <span className="codicon codicon-unmute" />
      Volume
      <div className="volume-controls">
        <button
          title="Volume Down"
          className="volume-button"
          onMouseDown={handleVolumeDecreaseDown}
          onMouseUp={handleVolumeDecreaseUp}
          onMouseLeave={handleVolumeDecreaseUp}>
          <span className="codicon codicon-remove" />
        </button>
        <button
          title="Volume Up"
          className="volume-button"
          onMouseDown={handleVolumeIncreaseDown}
          onMouseUp={handleVolumeIncreaseUp}
          onMouseLeave={handleVolumeIncreaseUp}>
          <span className="codicon codicon-add" />
        </button>
      </div>
    </div>
  );
};

export default DeviceSettingsDropdown;
