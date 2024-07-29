import { forwardRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import IconButton, { IconButtonProps } from "./shared/IconButton";
import "./IconButtonWithOptions.css";

interface IconButtonWithOptions extends IconButtonProps {
  options: Record<string, () => void>;
}

export const IconButtonWithOptions = forwardRef<HTMLButtonElement, IconButtonWithOptions>(
  (props, ref) => {
    const { options, children, ...iconButtonProps } = props;

    return (
      <div className="icon-container">
        <IconButton ref={ref} {...iconButtonProps}>
          {children}
        </IconButton>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            {<div className="dropdown-arrow codicon codicon-triangle-down" />}
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="dropdown-menu-content">
              {Object.entries(options).map(([title, onSelect]) => (
                <DropdownMenu.Item className="dropdown-menu-item" onSelect={onSelect}>
                  {title}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    );
  }
);
