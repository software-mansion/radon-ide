import React from "react";
import classnames from "classnames";
import "./IconButton.css";
import Tooltip from "./Tooltip";
import { usePing } from "../../hooks/usePing";
import { PropsWithDataTest } from "../../../common/types";

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
  shouldDisplayLabelWhileDisabled?: boolean;
}

const IconButton = React.forwardRef<HTMLButtonElement, PropsWithDataTest<IconButtonProps>>(
  (props, ref) => {
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
      shouldDisplayLabelWhileDisabled = false,
      dataTest,
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
        data-testid={dataTest}
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
        disabled={disabled && !shouldDisplayLabelWhileDisabled}
        side={tooltipSide}
        type={tooltipType ?? type}>
        {button}
      </Tooltip>
    );
  }
);

export default IconButton;
