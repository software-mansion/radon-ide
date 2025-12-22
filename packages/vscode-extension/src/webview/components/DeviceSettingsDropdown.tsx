import React from "react";
import { use$ } from "@legendapp/state/react";

import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Slider from "@radix-ui/react-slider";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as PaywallDropdownMenu from "./shared/PaywallDropdownMenu";
import * as DropdownMenuComponents from "./shared/DropdownMenuComponents";

import "./shared/Dropdown.css";
import "./shared/RadioGroup.css";
import "./shared/Slider.css";
import "./DeviceSettingsDropdown.css";
import "./shared/SwitchGroup.css";

import Label from "./shared/Label";
import { useProject } from "../providers/ProjectProvider";
import { AppPermissionType, DeviceRotationDirection } from "../../common/Project";
import { DeviceLocationView } from "../views/DeviceLocationView";
import { useModal } from "../providers/ModalProvider";
import { DeviceLocalizationView } from "../views/DeviceLocalizationView";
import { OpenDeepLinkView } from "../views/OpenDeepLinkView";
import { CameraSettingsView } from "../views/CameraSettingsView";
import ReplayIcon from "./icons/ReplayIcon";
import { useStore } from "../providers/storeProvider";
import { DevicePlatform, DeviceRotation, DeviceSettings } from "../../common/State";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";
import { Feature, FeatureAvailabilityStatus } from "../../common/License";
import { useIsFeatureAdminDisabled } from "../hooks/useIsFeatureAdminDisabled";

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

function DeviceAppearanceSettings() {
  const store$ = useStore();
  const appearance = use$(store$.workspaceConfiguration.deviceSettings.appearance);
  const contentSize = use$(store$.workspaceConfiguration.deviceSettings.contentSize);

  return (
    <form>
      <Label>Device appearance</Label>
      <RadioGroup.Root
        className="radio-group-root"
        defaultValue={appearance}
        onValueChange={(value) => {
          store$.workspaceConfiguration.deviceSettings.appearance.set(
            value as DeviceSettings["appearance"]
          );
        }}>
        <div className="radio-group-center">
          <RadioGroup.Item
            className="radio-group-item"
            value="light"
            id="r1"
            data-testid="device-appearance-light">
            <RadioGroup.Indicator className="radio-group-indicator" />
          </RadioGroup.Item>
          <label className="radio-group-label" htmlFor="r1">
            Light
          </label>
        </div>
        <div className="radio-group-center">
          <RadioGroup.Item
            className="radio-group-item"
            value="dark"
            id="r2"
            data-testid="device-appearance-dark">
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
          defaultValue={[contentSizes.indexOf(contentSize)]}
          max={6}
          step={1}
          onValueCommit={([value]) => {
            store$.workspaceConfiguration.deviceSettings.contentSize.set(contentSizes[value]);
          }}>
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb className="slider-thumb" aria-label="Text Size" />
          <div className="slider-track-dent-container">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="slider-track-dent"
                data-testid={`device-settings-font-size-slider-track-dent-${i}`}
              />
            ))}
          </div>
        </Slider.Root>
        <span className="device-settings-large-text-indicator" />
      </div>
      <div className="device-settings-margin" />
    </form>
  );
}

function RotateSettingsSubmenu() {
  const store$ = useStore();

  const rotation = use$(store$.workspaceConfiguration.deviceSettings.deviceRotation);
  const isDeviceRotationAvailable = use$(() => {
    return (
      store$.license.featuresAvailability.DeviceRotation.get() ===
      FeatureAvailabilityStatus.AVAILABLE
    );
  });

  const { project } = useProject();
  const handleRotateDevice = (direction: DeviceRotationDirection) => {
    project.rotateDevices(direction);
  };

  const handleSetRotateDevice = (deviceRotation: DeviceRotation) => {
    store$.workspaceConfiguration.deviceSettings.deviceRotation.set(deviceRotation);
  };

  return (
    <PaywallDropdownMenu.Sub proFeature={Feature.DeviceRotation}>
      <DropdownMenu.SubTrigger
        className="dropdown-menu-item"
        data-testid="device-settings-rotate-device-menu-trigger">
        <span className="codicon codicon-sync" />
        Rotate Device
        <span className="codicon codicon-chevron-right right-slot" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          className="dropdown-menu-subcontent"
          data-testid="rotate-device-submenu"
          sideOffset={2}
          alignOffset={-5}>
          <Label>Rotate</Label>
          <DropdownMenuComponents.CommandItem
            onSelect={() => handleRotateDevice(DeviceRotationDirection.Clockwise)}
            commandName={"RNIDE.rotateDeviceClockwise"}
            label={"Clockwise"}
            dataTest={`device-settings-set-orientation-clockwise`}
            icon={"refresh"}
          />
          <DropdownMenuComponents.CommandItem
            onSelect={() => handleRotateDevice(DeviceRotationDirection.Anticlockwise)}
            commandName={"RNIDE.rotateDeviceAnticlockwise"}
            label={"Anticlockwise"}
            dataTest={`device-settings-set-orientation-anticlockwise`}
            icon={"refresh mirror"}
          />

          <div className="device-settings-margin" />
          <Label>Set Orientation</Label>

          {setOrientationOptions.map((option, index) => (
            <DropdownMenu.Item
              className="dropdown-menu-item"
              data-testid={`device-settings-set-orientation-${option.label.trim().toLowerCase().replace(/\s+/g, "-")}`}
              key={index}
              disabled={!isDeviceRotationAvailable && option.value !== DeviceRotation.Portrait}
              onSelect={() => handleSetRotateDevice(option.value)}>
              <span
                className={`codicon codicon-${option.icon}`}
                style={{ rotate: option.rotation }}
              />
              {option.label}
              {rotation === option.value && <span className="codicon codicon-check right-slot" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </PaywallDropdownMenu.Sub>
  );
}

function PermissionsSubmenu({ platform }: { platform: DevicePlatform | undefined }) {
  const resetOptions = platform === DevicePlatform.IOS ? resetOptionsIOS : resetOptionsAndroid;
  const { project } = useProject();
  return (
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
  );
}

function DeviceSettingsDropdown({ children, disabled }: DeviceSettingsDropdownProps) {
  const store$ = useStore();
  const selectedDeviceSessionState = useSelectedDeviceSessionState();

  const showDeviceFrame = use$(store$.workspaceConfiguration.userInterface.showDeviceFrame);

  const deviceInfo = use$(selectedDeviceSessionState.deviceInfo);

  const platform = deviceInfo?.platform;

  const deviceSettings = use$(store$.workspaceConfiguration.deviceSettings);

  const { project } = useProject();

  const { openModal } = useModal();

  const isPhysicalAndroid = platform === DevicePlatform.Android && !deviceInfo?.emulator;

  const isSendFilesAdminDisabled = useIsFeatureAdminDisabled(Feature.SendFile);


  return (
    <DropdownMenuComponents.DropdownMenuRoot>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-menu-content device-settings-content"
          data-testid="device-settings-dropdown-menu"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <h4 className="device-settings-heading">Device Settings</h4>
          {!isPhysicalAndroid && <DeviceAppearanceSettings />}
          <DropdownMenuComponents.CommandItem
            onSelect={() => project.dispatchHomeButtonPress()}
            commandName="RNIDE.deviceHomeButtonPress"
            label="Press Home Button"
            icon="home"
            dataTest="press-home-button"
          />
          <DropdownMenuComponents.CommandItem
            onSelect={() => project.dispatchAppSwitchButtonPress()}
            commandName="RNIDE.deviceAppSwitchButtonPress"
            label="Open App Switcher"
            icon="chrome-restore"
            dataTest="open-app-switcher-button"
          />
          <RotateSettingsSubmenu />
          {platform === DevicePlatform.IOS && <BiometricsItem />}
          {!isSendFilesAdminDisabled && (
            <PaywallDropdownMenu.Item
              proFeature={Feature.SendFile}
              className="dropdown-menu-item"
              data-testid="device-settings-send-file"
              disabled={isSendFilesAdminDisabled}
              onSelect={project.openSendFileDialog}>
              <span className="codicon codicon-share" />
              Send File
            </PaywallDropdownMenu.Item>
          )}
          {!isPhysicalAndroid && (
            <>
              <LocationItem />
              <LocalizationItem />
              <VolumeItem />
            </>
          )}
          {platform === DevicePlatform.Android && deviceInfo?.emulator && <CameraItem />}
          {!isPhysicalAndroid && <PermissionsSubmenu platform={platform} />}
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => openModal(<OpenDeepLinkView />, { title: "Open Deep Link" })}>
            <span className="codicon codicon-link" />
            Open Deep Link
          </DropdownMenu.Item>

          <PaywallDropdownMenu.SwitchItem
            icon={<ReplayIcon />}
            proFeature={Feature.ScreenReplay}
            checked={deviceSettings.replaysEnabled}
            onCheckedChange={(checked) =>
              store$.workspaceConfiguration.deviceSettings.replaysEnabled.set(checked)
            }
            dataTestId="device-settings-enable-replays-switch"
            id="enable-replays">
            Enable Replays
          </PaywallDropdownMenu.SwitchItem>

          <DropdownMenuComponents.SwitchItem
            icon={<span className="codicon codicon-record" />}
            checked={deviceSettings.showTouches}
            onCheckedChange={(checked) =>
              store$.workspaceConfiguration.deviceSettings.showTouches.set(checked)
            }
            dataTestId="device-settings-show-touches-switch"
            id="show-touches">
            Show Touches
          </DropdownMenuComponents.SwitchItem>

          {!isPhysicalAndroid && (
            <DropdownMenuComponents.SwitchItem
              icon={<span className="codicon codicon-device-mobile" />}
              checked={showDeviceFrame}
              onCheckedChange={(checked) =>
                store$.workspaceConfiguration.userInterface.showDeviceFrame.set(checked)
              }
              dataTestId="device-settings-show-device-frame-switch"
              id="show-device-frame">
              Show Device Frame
            </DropdownMenuComponents.SwitchItem>
          )}
          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenuComponents.DropdownMenuRoot>
  );
}

const LocationItem = () => {
  const isLocationAdminDisabled = useIsFeatureAdminDisabled(Feature.LocationSimulation);

  const { openModal } = useModal();
  return (
    <PaywallDropdownMenu.Item
      className="dropdown-menu-item"
      data-testid="device-settings-location"
      disabled={isLocationAdminDisabled}
      onSelect={() => openModal(<DeviceLocationView />, { title: "Location" })}
      proFeature={Feature.LocationSimulation}>
      <span className="codicon codicon-location" />
      Location
    </PaywallDropdownMenu.Item>
  );
};

const LocalizationItem = () => {
  const isLocalizationAdminDisabled = useIsFeatureAdminDisabled(Feature.DeviceLocalizationSettings);
  const { openModal } = useModal();

  return (
    <PaywallDropdownMenu.Item
      className="dropdown-menu-item"
      disabled={isLocalizationAdminDisabled}
      onSelect={() => openModal(<DeviceLocalizationView />, { title: "Localization" })}
      data-testid="device-settings-localization"
      proFeature={Feature.DeviceLocalizationSettings}>
      <span className="codicon codicon-globe" />
      Localization
    </PaywallDropdownMenu.Item>
  );
};

const BiometricsItem = () => {
  const store$ = useStore();

  const isBiometricsAdminDisabled = useIsFeatureAdminDisabled(Feature.Biometrics);

  const deviceSettings = use$(store$.workspaceConfiguration.deviceSettings);

  const { project } = useProject();

  const handleToggleBiometricsEnrolment = () => {
    store$.workspaceConfiguration.deviceSettings.hasEnrolledBiometrics.set(
      !deviceSettings.hasEnrolledBiometrics
    );
  };

  const handleSendBiometricAuthorization = async (isMatching: boolean) => {
    await project.sendBiometricAuthorization(isMatching);
  };

  return (
    <PaywallDropdownMenu.Sub proFeature={Feature.Biometrics}>
      <DropdownMenu.SubTrigger disabled={isBiometricsAdminDisabled} className="dropdown-menu-item">
        <span className="codicon codicon-layout" />
        Biometrics
        <span className="codicon codicon-chevron-right right-slot" />
      </DropdownMenu.SubTrigger>

      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="dropdown-menu-subcontent">
          <DropdownMenu.Item
            className="dropdown-menu-item"
            disabled={isBiometricsAdminDisabled}
            onSelect={handleToggleBiometricsEnrolment}>
            <span className="codicon codicon-layout-sidebar-left" />
            Enrolled
            {deviceSettings.hasEnrolledBiometrics && (
              <span className="codicon codicon-check right-slot" />
            )}
          </DropdownMenu.Item>
          <DropdownMenuComponents.CommandItem
            onSelect={() => {
              handleSendBiometricAuthorization(true);
            }}
            commandName="RNIDE.performBiometricAuthorization"
            label="Matching ID"
            icon="layout-sidebar-left"
            disabled={!deviceSettings.hasEnrolledBiometrics || isBiometricsAdminDisabled}
          />
          <DropdownMenuComponents.CommandItem
            onSelect={() => {
              handleSendBiometricAuthorization(false);
            }}
            commandName="RNIDE.performFailedBiometricAuthorization"
            label="Non-Matching ID"
            icon="layout-sidebar-left"
            disabled={!deviceSettings.hasEnrolledBiometrics || isBiometricsAdminDisabled}
            proFeature={Feature.Biometrics}
          />
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </PaywallDropdownMenu.Sub>
  );
};

const CameraItem = () => {
  const { openModal } = useModal();

  return (
    <PaywallDropdownMenu.Item
      className="dropdown-menu-item"
      onSelect={() => {
        openModal(<CameraSettingsView />, { title: "Camera Settings" });
      }}>
      <span className="codicon codicon-device-camera" />
      Camera Settings
    </PaywallDropdownMenu.Item>
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
