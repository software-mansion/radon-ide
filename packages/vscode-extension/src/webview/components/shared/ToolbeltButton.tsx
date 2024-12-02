import React, { useState } from "react";
import * as Select from "@radix-ui/react-select";
import "./ToolbeltButton.css";


export interface ToolbeltOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface ToolbeltButtonProps {
  options: ToolbeltOption[],
  defaultOptionIndex?: number,
  onSelect: (value: string) => void,
}

function ToolbeltButton({
  options,
  defaultOptionIndex = 0,
  onSelect,
}: ToolbeltButtonProps) {

  const [selectedOption, setSelectedOption] = useState(options[defaultOptionIndex]);

  const handleSelect = (value: string) => {
    const selected = options.find(option => option.value === value);
    setSelectedOption(selected || options[defaultOptionIndex]);
    onSelect(value);
  };

  return (
    <div className="toolbelt-button-container">
      <button className="toolbelt-button-main-button">
        <span>{selectedOption.icon}</span>
      </button>

      <Select.Root onValueChange={handleSelect}>
        <Select.Trigger className="toolbelt-button-select-trigger">
          <span className="codicon codicon-chevron-down" />
        </Select.Trigger>

        <Select.Portal>
          <Select.Content className="toolbelt-button-select-content">
            <Select.Viewport className="toolbelt-button-select-viewport">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="toolbelt-button-select-item">
                  <div className="toolbelt-button-select-item-content">
                    {option.icon && <span className="icon">{option.icon}</span>}
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </div>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

export default ToolbeltButton;
