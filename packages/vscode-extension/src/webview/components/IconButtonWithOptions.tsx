import { forwardRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import classNames from "classnames";
import IconButton, { IconButtonProps } from "./shared/IconButton";
import "./IconButtonWithOptions.css";
import { DropdownMenuRoot } from "./DropdownMenuRoot";

interface IconButtonWithOptionsProps extends IconButtonProps {
  options: Record<string, () => void>;
  disabled?: boolean;
}

export const IconButtonWithOptions = forwardRef<HTMLButtonElement, IconButtonWithOptionsProps>(
  (props, ref) => {
    const { options, disabled, children, ...iconButtonProps } = props;

    return (
      <div className="icon-button-with-options-container">
        <IconButton ref={ref} disabled={disabled} side="left" size="none" {...iconButtonProps}>
          {children}
        </IconButton>
        <IconButton ref={ref} disabled={disabled} side="right" size="none">
          <DropdownMenuRoot>
            <DropdownMenu.Trigger asChild disabled={disabled}>
              <div
                className={classNames(
                  "dropdown-arrow codicon codicon-triangle-down",
                  disabled && "dropdown-arrow-disabled"
                )}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="dropdown-menu-content"
                side="bottom"
                align="start"
                sideOffset={12}
                alignOffset={0}>
                {Object.entries(options).map(([title, onSelect], index) => (
                  <DropdownMenu.Item className="dropdown-menu-item" key={index} onSelect={onSelect}>
                    {title}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenuRoot>
        </IconButton>
      </div>
    );
  }
);
