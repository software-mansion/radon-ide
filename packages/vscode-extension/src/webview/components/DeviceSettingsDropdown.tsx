import React, { useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Slider from "@radix-ui/react-slider";

import "./shared/Dropdown.css";
import "./shared/RadioGroup.css";
import "./shared/Slider.css";
import "./DeviceSettingsDropdown.css";

import Label from "./shared/Label";
import { useProject } from "../providers/ProjectProvider";
import { DeviceSettings } from "../../common/Project";
import DoctorIcon from "./icons/DoctorIcon";
import { DeviceLocationView } from "../views/DeviceLocationView";
import { JSX } from "react/jsx-runtime";
import DiagnosticView from "../views/DiagnosticView";
import { useModal } from "../providers/ModalProvider";

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

function DeviceSettingsDropdown({ children, disabled }: DeviceSettingsDropdownProps) {
  const { project, deviceSettings } = useProject();
  const { openModal } = useModal();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown-menu-content device-settings-content">
          <h4 className="device-settings-heading">Device Settings</h4>
          <Label>device appearance</Label>
          <form>
            <RadioGroup.Root
              className="dropdown-menu-content  radio-group-root"
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
            <Label>text size</Label>
            <div className="device-settings-center">
              <span className="device-settings-small-text-indicator" />
              <Slider.Root
                className="slider-root"
                defaultValue={[contentSizes.indexOf(deviceSettings.contentSize)]}
                max={6}
                step={1}
                onValueChange={([value]) => {
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

            <DropdownMenu.Arrow className="dropdown-menu-arrow" />
          </form>
          <Label>Device Location</Label>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              openModal("Location", <DeviceLocationView />);
            }}>
            <span className="codicon codicon-location" />
            Set Device Location
          </DropdownMenu.Item>
          <Label>Permissions</Label>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="dropdown-menu-item">
              <span className="codicon codicon-redo" />
              Reset Permissions
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="dropdown-menu-content"
                sideOffset={2}
                alignOffset={-5}>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => project.resetAppPermissions("all")}>
                  <span className="codicon codicon-check-all" />
                  Reset All Permissions
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => project.resetAppPermissions("location")}>
                  <span className="codicon codicon-location" />
                  Reset Location
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => project.resetAppPermissions("photos")}>
                  <span className="codicon codicon-file-media" />
                  Reset Photos
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => project.resetAppPermissions("contacts")}>
                  <span className="codicon codicon-organization" />
                  Reset Contacts
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => project.resetAppPermissions("calendar")}>
                  <span className="codicon codicon-calendar" />
                  Reset Calendar
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default DeviceSettingsDropdown;
