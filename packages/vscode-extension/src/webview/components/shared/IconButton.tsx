import React from "react";
import classnames from "classnames";
import "./IconButton.css";
import { use$ } from "@legendapp/state/react";
import Tooltip from "./Tooltip";
import { usePing } from "../../hooks/usePing";
import { PropsWithDataTest } from "../../../common/types";
import { useStore } from "../../providers/storeProvider";
import { Feature } from "../../../common/License";
import { usePaywalledCallback } from "../../hooks/usePaywalledCallback";

export interface IconButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  disabled?: boolean;
  disableTooltip?: boolean;
  counter?: number;
  counterMode?: "full" | "compact";
  proFeature?: Feature;
  proFeatureDependencies?: unknown[];
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
      onClick = () => {},
      tooltip,
      disabled,
      active,
      type = "primary",
      size = "default",
      side = "center",
      className = "",
      shouldDisplayLabelWhileDisabled = false,
      dataTest,
      proFeature,
      proFeatureDependencies = [],
      ...rest
    } = props;

    const store$ = useStore();
    const licenseStatus = use$(store$.license.status);

    const isProFeature = proFeature !== undefined;
    const isLocked = isProFeature && (licenseStatus === "free" || licenseStatus === "inactive");

    const wrappedOnClick = proFeature
      ? usePaywalledCallback(onClick, proFeature, proFeatureDependencies)
      : onClick;

    const shouldPing = usePing(counter ?? 0, counterMode);
    const showCounter = Boolean(counter);
    const button = (
      <button
        onClick={wrappedOnClick}
        disabled={disabled}
        className={classnames(
          "icon-button",
          type === "secondary" && "icon-button-secondary",
          active && "icon-button-selected",
          size === "default" && "icon-button-default",
          size === "small" && "icon-button-small",
          side === "left" && "icon-button-left",
          side === "right" && "icon-button-right",
          isLocked && "locked",
          className
        )}
        data-testid={dataTest}
        {...rest}
        ref={ref}>
        {children}
        {isLocked && <span className={"pro-feature-badge"}>PRO</span>}
        {!isProFeature && counterMode === "full" && counter !== null && (
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
