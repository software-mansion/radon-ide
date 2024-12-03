import React, { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "./ToolbeltButton.css";

export interface ToolbeltOption {
  label: string;
  component: React.ReactElement;
  dropdownIcon: React.ReactNode;
  keybinding?: React.ReactNode;
}

interface ToolbeltButtonProps {
  options: ToolbeltOption[];
  defaultOptionIndex?: number;
  disabled?: boolean;
}

function ToolbeltButton({
  options,
  defaultOptionIndex = 0,
  disabled = false,
}: ToolbeltButtonProps) {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(defaultOptionIndex);

  const handleSelect = (option: ToolbeltOption) => {
    const index = options.findIndex((o) => o.label === option.label);
    setSelectedOptionIndex(index);
  };

  return (
    <div className="toolbelt-button-container">
      {React.cloneElement(options[selectedOptionIndex].component, {
        className: `toolbelt-button-main-button ${options[selectedOptionIndex].component.props.className}`,
      })}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger disabled={disabled} className="toolbelt-button-dropdown-trigger">
          <span className="codicon codicon-chevron-down" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="dropdown-menu-content toolbelt-button-dropdown-content"
            side="bottom"
            align="end">
            {options.map((option) => (
              <DropdownMenu.Item
                key={option.label}
                onClick={() => handleSelect(option)}
                className="toolbelt-button-select-item">
                <span className="toolbelt-button-dropdown-item-wraper">
                  {option.dropdownIcon && <span className="icon">{option.dropdownIcon}</span>}
                  <div className="toolbelt-button-dropdown-item-content">
                    <span>{option.label}</span>
                    {options[selectedOptionIndex].keybinding}
                  </div>
                </span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export default ToolbeltButton;

// EXAMPLE USAGE (WITH RECORDING AND SCREENSHOTS TOOLS):
/*
        {
          <ToolbeltButton
            options={[
              {
                label: "Record",
                component: (
                  <IconButton
                    className={isRecording ? "button-recording-on" : ""}
                    tooltip={{
                      label: isRecording ? "Stop screen recording" : "Start screen recording",
                    }}
                    onClick={toggleRecording}>
                    {isRecording ? (
                      <div className="recording-rec-indicator">
                        <div className="recording-rec-dot" />
                        <span>{recordingTimeFormat}</span>
                      </div>
                    ) : (
                      <RecordingIcon />
                    )}
                  </IconButton>
                ),
                dropdownIcon: <RecordingIcon />,
                keybinding: <KeybindingInfo commandName="RNIDE.openDevMenu" />, // TODO add shortcuts
              },
              {
                label: "Screenshot",
                component: (
                  <IconButton
                    tooltip={{
                      label: "Take screenshot",
                    }}
                    onClick={() => {}}>
                    <span slot="start" className="codicon codicon-device-camera" />
                  </IconButton>
                ),
                dropdownIcon: <span slot="start" className="codicon codicon-device-camera" />,
                keybinding: <KeybindingInfo commandName="RNIDE.openDevMenu" />, // TODO add shortcuts
              },
            ]}
            disabled={devicesNotFound || isStarting}
          />;
        }
        */
