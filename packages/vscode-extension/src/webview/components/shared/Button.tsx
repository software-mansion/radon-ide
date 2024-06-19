import classNames from "classnames";
import "./Button.css";
import Tooltip from "./Tooltip";

interface ButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "primary" | "secondary" | "ternary" | "submit";
  disabled?: boolean;
  counter?: number;
  active?: boolean;
  children: React.ReactNode;
  tooltip?: {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    type?: "primary" | "secondary";
  };
  className?: string;
}

function Button({
  counter,
  children,
  onClick,
  className,
  type = "primary",
  disabled,
  active,
  tooltip,
}: ButtonProps) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "button",
        type === "secondary" && "button-secondary",
        type === "ternary" && "button-ternary",
        active && "button-selected",
        className
      )}>
      {children}
      {Boolean(counter) && <span className="button-counter">{counter}</span>}
    </button>
  );
  if (!tooltip) {
    return button;
  }

  const { label, side, type: tooltipType } = tooltip;

  const supportedType = type === "ternary" ? "primary" : type;
  return (
    <Tooltip label={label} side={side} type={tooltipType ?? supportedType}>
      {button}
    </Tooltip>
  );
}

export default Button;
