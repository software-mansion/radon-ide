import { forwardRef, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import IconButton, { IconButtonProps } from "./shared/IconButton";
import "./IconButtonWithOptions.css";
import classNames from "classnames";

interface IconButtonWithOptions extends IconButtonProps {
  options: Record<string, () => void>;
}

export const IconButtonWithOptions = forwardRef<HTMLButtonElement, IconButtonWithOptions>(
  (props, ref) => {
    const { options, children, ...iconButtonProps } = props;

    const timer = useRef<NodeJS.Timeout | undefined>(undefined);
    const [dropdownTriggerVisible, setDropdownTriggerVisible] = useState(false);

    function toggleTriggerVisibility(hovering: boolean) {
      const DELAY_MS = 1_000;

      if (hovering) {
        setDropdownTriggerVisible(true);
        clearTimeout(timer.current);
      } else {
        timer.current = setTimeout(() => {
          setDropdownTriggerVisible(false);
        }, DELAY_MS);
      }
    }

    return (
      <div className="icon-container">
        <IconButton
          ref={ref}
          {...iconButtonProps}
          onHover={(hovering) => {
            toggleTriggerVisibility(hovering);
          }}>
          {children}
        </IconButton>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            {
              <div
                className={classNames(
                  "dropdown-arrow codicon codicon-triangle-down",
                  !dropdownTriggerVisible && "dropdown-arrow-hide"
                )}
              />
            }
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
