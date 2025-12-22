import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Switch from "@radix-ui/react-switch";
import { PropsWithChildren, useEffect, useState } from "react";
import * as PaywallDropdownMenu from "./PaywallDropdownMenu";
import { KeybindingInfo } from "./KeybindingInfo";
import { PropsWithDataTest } from "../../../common/types";
import { Feature } from "../../../common/License";
import classNames from "classnames";

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

  const open = openExternal !== undefined ? openExternal : openInternal;

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
  proFeature,
  proFeatureDependencies,
}: PropsWithDataTest<{
  onSelect: () => void;
  commandName: string;
  label: string;
  icon: string;
  disabled?: boolean;
  proFeature?: Feature;
  proFeatureDependencies?: unknown[];
}>) {
  return (
    <PaywallDropdownMenu.Item
      className="dropdown-menu-item"
      onSelect={onSelect}
      disabled={disabled}
      data-testid={dataTest}
      proFeature={proFeature}
      proFeatureDependencies={proFeatureDependencies}>
      <span className="dropdown-menu-item-wraper">
        <span className={`codicon codicon-${icon}`} />
        <div className="dropdown-menu-item-content">
          {label}
          <KeybindingInfo commandName={commandName} />
        </div>
      </span>
    </PaywallDropdownMenu.Item>
  );
}

export interface SwitchItemProps extends Switch.SwitchProps {
  icon: React.ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onClick?: () => void;
  dataTestId: string;
  id: string;
}

export function SwitchItem({
  icon,
  checked,
  onCheckedChange,
  onClick = () => {},
  dataTestId,
  id,
  children,
  className,
  ...props
}: SwitchItemProps) {
  return (
    <div className={classNames("dropdown-menu-item", className)} onClick={onClick}>
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
