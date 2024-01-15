import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Slider from "@radix-ui/react-slider";

import "./shared/Dropdown.css";
import "./shared/RadioGroup.css";
import "./shared/Slider.css";
import "./DeviceSettingsDropdown.css";

import { vscode } from "../utilities/vscode";
import Label from "./shared/Label";

const textSize = ["xsmall", "small", "normal", "large", "xlarge", "xxlarge", "xxxlarge"] as const;

export interface DeviceSettings {
  appearance: "light" | "dark";
  contentSize: "xsmall" | "small" | "normal" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
}

interface DeviceSettingsDropdownProps {
  children: React.ReactNode;
  deviceSettings: DeviceSettings;
  setDeviceSettings: React.Dispatch<DeviceSettings>;
}

function DeviceSettingsDropdown({
  children,
  deviceSettings,
  setDeviceSettings,
}: DeviceSettingsDropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <div>{children}</div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown-menu-content device-settings-content">
          <h4 className="device-settings-heading">Device Settings</h4>
          <Label>device appearance</Label>
          <RadioGroup.Root
            className="radio-group-root"
            defaultValue="light"
            onValueChange={(value: string) => {
              const appearance = value as "light" | "dark";
              const newSettings = { ...deviceSettings, appearance };
              setDeviceSettings(newSettings);
              vscode.postMessage({
                command: "changeDeviceSettings",
                settings: newSettings,
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
              defaultValue={[1]}
              max={6}
              step={1}
              onValueChange={(valueArray) => {
                const value = valueArray[0];
                const newSettings = { ...deviceSettings, contentSize: textSize[value] };
                setDeviceSettings(newSettings);
                vscode.postMessage({
                  command: "changeDeviceSettings",
                  settings: newSettings,
                });
              }}>
              <Slider.Track className="slider-track">
                <Slider.Range className="slider-range" />
              </Slider.Track>
              <Slider.Thumb className="slider-thumb" aria-label="Text Size" />
              <div className="slider-track-dent-container">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div className="slider-track-dent" />
                ))}
              </div>
            </Slider.Root>
            <span className="device-settings-large-text-indicator" />
          </div>

          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default DeviceSettingsDropdown;
