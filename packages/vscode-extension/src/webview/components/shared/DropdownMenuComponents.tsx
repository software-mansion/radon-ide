import { PropsWithChildren, useEffect, useState } from "react";
import classNames from "classnames";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Switch from "@radix-ui/react-switch";

import { KeybindingInfo } from "./KeybindingInfo";
import { PropsWithDataTest } from "../../../common/types";

interface DropdownMenuRootProps extends PropsWithChildren {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DropdownMenuRoot({
  children,
  open: openExternal,
  onOpenChange,
}: DropdownMenuRootProps) {
  const [openInternal, setOpenInternal] = useState(false);

  const open = openExternal ?? openInternal;

  const handleSetOpen = (e: boolean) => {
    if (onOpenChange) {
      onOpenChange(e);
    }
    setOpenInternal(e);
  };

  useEffect(() => {
    const blurListener = () => {
      handleSetOpen(false);
    };
    window.addEventListener("blur", blurListener);
    return () => {
      window.removeEventListener("blur", blurListener);
    };
  }, []);

  return (
    <DropdownMenu.Root open={open} onOpenChange={handleSetOpen}>
      {children}
    </DropdownMenu.Root>
  );
}

export function CommandItem({
  onSelect,
  commandName,
  label,
  icon,
  disabled = false,
  dataTest,
}: PropsWithDataTest<{
  onSelect: () => void;
  commandName: string;
  label: string;
  icon: string;
  disabled?: boolean;
}>) {
  return (
    <DropdownMenu.Item
      className="dropdown-menu-item"
      onSelect={onSelect}
      disabled={disabled}
      data-testid={dataTest}>
      <span className="dropdown-menu-item-wraper">
        <span className={`codicon codicon-${icon}`} />
        <div className="dropdown-menu-item-content">
          {label}
          <KeybindingInfo commandName={commandName} />
        </div>
      </span>
    </DropdownMenu.Item>
  );
}

export interface SwitchItemProps extends Switch.SwitchProps {
  icon: React.ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onMenuItemClick?: (e: React.MouseEvent<HTMLDivElement> | undefined) => void;
  dataTestId: string;
  id: string;
}

export function SwitchItem({
  icon,
  checked,
  onMenuItemClick,
  onCheckedChange,
  dataTestId,
  id,
  children,
  className,
  ...props
}: SwitchItemProps) {
  return (
    <div className={classNames("dropdown-menu-item", className)} onClick={onMenuItemClick}>
      {icon}
      {children}
      <Switch.Root
        {...props}
        className="switch-root small-switch"
        data-testid={dataTestId}
        id={id}
        onCheckedChange={onCheckedChange}
        defaultChecked={checked}
        style={{ marginLeft: "auto" }}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </div>
  );
}
