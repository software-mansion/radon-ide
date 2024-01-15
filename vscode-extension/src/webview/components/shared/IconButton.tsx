import classnames from "classnames";
import "./IconButton.css";
import Tooltip from "./Tooltip";

interface IconButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  type?: "primary" | "secondary";
  size?: "default" | "small";
  tooltip?: {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
  };
  className?: string;
}

function IconButton({
  children,
  onClick,
  tooltip,
  disabled,
  active,
  type = "primary",
  size = "default",
  className = "",
}: IconButtonProps) {
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
      )}>
      {children}
    </button>
  );

  if (!tooltip) {
    return button;
  }

  const { label, side } = tooltip;

  return (
    <Tooltip label={label} side={side} type={type}>
      {button}
    </Tooltip>
  );
}

export default IconButton;
