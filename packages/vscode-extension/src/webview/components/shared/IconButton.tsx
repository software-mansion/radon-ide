import React, { useEffect, useState } from "react";
import classnames from "classnames";
import "./IconButton.css";
import Tooltip from "./Tooltip";

export interface IconButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  disabled?: boolean;
  disableTooltip?: boolean;
  showNewBadge?: boolean;
  active?: boolean;
  type?: "primary" | "secondary";
  side?: "left" | "right" | "center";
  size?: "default" | "small" | "none";
  tooltip?: {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    type?: "primary" | "secondary";
  };
  className?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>((props, ref) => {
  const {
    showNewBadge,
    children,
    onClick,
    tooltip,
    disabled,
    active,
    type = "primary",
    size = "default",
    side = "center",
    className = "",
    ...rest
  } = props;

  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classnames(
        "icon-button",
        type === "secondary" && "icon-button-secondary",
        active && "icon-button-selected",
        size === "default" && "icon-button-default",
        size === "small" && "icon-button-small",
        side === "left" && "icon-button-left",
        side === "right" && "icon-button-right",
        className
      )}
      {...rest}
      ref={ref}>
      {children}
      {showNewBadge && <span className="icon-button-new-badge" />}
    </button>
  );

  if (!tooltip) {
    return button;
  }

  const { label, side: tooltipSide, type: tooltipType } = tooltip;

  return (
    <Tooltip label={label} side={tooltipSide} type={tooltipType ?? type}>
      {button}
    </Tooltip>
  );
});

export default IconButton;
