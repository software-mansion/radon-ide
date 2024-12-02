import React, { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "./ToolbeltButton.css";

export interface ToolbeltOption {
  label: string;
  button: React.ReactNode;
  icon?: React.ReactNode;
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
  const [selectedOption, setSelectedOption] = useState(options[defaultOptionIndex]);

 const handleSelect = (option: ToolbeltOption) => {
   setSelectedOption(option);
 };

  return (
    <div className="toolbelt-button-container">
      <button className="toolbelt-button-main-button" disabled={disabled}>
        {selectedOption.button}
      </button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger disabled={disabled} className="button-main">
          <span className="codicon codicon-chevron-down" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="toolbelt-button-dropdown-content">
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.label}
              onClick={() => handleSelect(option)}
              className="toolbelt-button-dropdown-item">
              <div className="toolbelt-button-dropdown-item-content">
                {option.icon && <span className="icon">{option.icon}</span>}
                <span>{option.label}</span>
              </div>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}

export default ToolbeltButton;
