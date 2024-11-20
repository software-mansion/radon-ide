import React from "react";
import classnames from "classnames";
import "./IconButton.css";
import Tooltip from "./Tooltip";

export interface IconButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  disabled?: boolean;
  counter?: number;
  active?: boolean;
  type?: "primary" | "secondary";
  size?: "default" | "small";
  tooltip?: {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    type?: "primary" | "secondary";
  };
  className?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>((props, ref) => {
  const {
    counter,
    children,
    onClick,
    tooltip,
    disabled,
    active,
    type = "primary",
    size = "default",
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
        size === "small" && "icon-button-small",
        className
      )}
      {...rest}
      ref={ref}>
      {children}
      {Boolean(counter) && <span className="icon-button-counter">{counter}</span>}
    </button>
  );

  if (!tooltip) {
    return button;
  }

  const { label, side, type: tooltipType } = tooltip;

  return (
    <Tooltip label={label} side={side} type={tooltipType ?? type}>
      {button}
    </Tooltip>
  );
});

export default IconButton;
