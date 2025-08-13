import React from "react";
import classnames from "classnames";
import "./IconButton.css";
import Tooltip from "./Tooltip";
import { usePing } from "../../hooks/usePing";

export interface IconButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  disabled?: boolean;
  disableTooltip?: boolean;
  counter?: number;
  counterMode?: "full" | "compact";
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
<<<<<<< HEAD
  shouldDisplayLabelWhileDisabled?: boolean;
=======
  dataTest?: string;
>>>>>>> @KeyJayY/UITesting
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>((props, ref) => {
  const {
    counter,
    counterMode = "full",
    children,
    onClick,
    tooltip,
    disabled,
    active,
    type = "primary",
    size = "default",
    side = "center",
    className = "",
<<<<<<< HEAD
    shouldDisplayLabelWhileDisabled = false,
=======
    dataTest,
>>>>>>> @KeyJayY/UITesting
    ...rest
  } = props;

  const shouldPing = usePing(counter ?? 0, counterMode);

  const showCounter = Boolean(counter);
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
      data-test={dataTest}
      {...rest}
      ref={ref}>
      {children}
      {counterMode === "full" && counter !== null && (
        <span className={classnames("icon-button-counter", showCounter && "visible")}>
          {counter}
        </span>
      )}
      {counterMode === "compact" && counter !== null && (
        <span
          className={classnames(
            "icon-button-indicator",
            showCounter && "visible",
            shouldPing && "ping"
          )}
        />
      )}
    </button>
  );

  if (!tooltip) {
    return button;
  }

  const { label, side: tooltipSide, type: tooltipType } = tooltip;

  return (
    <Tooltip
      label={label}
      disabled={!shouldDisplayLabelWhileDisabled}
      side={tooltipSide}
      type={tooltipType ?? type}>
      {button}
    </Tooltip>
  );
});

export default IconButton;
