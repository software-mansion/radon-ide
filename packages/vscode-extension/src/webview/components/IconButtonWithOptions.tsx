import { forwardRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import classNames from "classnames";
import IconButton, { IconButtonProps } from "./shared/IconButton";
import "./IconButtonWithOptions.css";
import { DropdownMenuRoot } from "./DropdownMenuRoot";

interface IconButtonWithOptions extends IconButtonProps {
  options: Record<string, () => void>;
  disabled?: boolean;
}

export const IconButtonWithOptions = forwardRef<HTMLButtonElement, IconButtonWithOptions>(
  (props, ref) => {
    const { options, disabled, children, ...iconButtonProps } = props;

    const [dropdownTriggerVisible, setDropdownTriggerVisible] = useState(false);

    return (
      <div
        className="icon-container"
        onMouseEnter={() => {
          setDropdownTriggerVisible(true);
        }}
        onMouseLeave={() => {
          setDropdownTriggerVisible(false);
        }}>
        <IconButton ref={ref} disabled={disabled} {...iconButtonProps}>
          {children}
        </IconButton>
        <DropdownMenuRoot>
          <DropdownMenu.Trigger asChild disabled={disabled}>
            {
              <div
                className={classNames(
                  "dropdown-arrow codicon codicon-triangle-down",
                  (!dropdownTriggerVisible || disabled) && "dropdown-arrow-hide"
                )}
              />
            }
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="dropdown-menu-content">
              {Object.entries(options).map(([title, onSelect], index) => (
                <DropdownMenu.Item className="dropdown-menu-item" key={index} onSelect={onSelect}>
                  {title}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenuRoot>
      </div>
    );
  }
);
