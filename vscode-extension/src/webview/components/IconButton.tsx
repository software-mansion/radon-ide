import "./IconButton.css";
import * as Tooltip from "@radix-ui/react-tooltip";

interface IconButtonProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  tooltip?: {
    label?: string;
    side?: "top" | "right" | "bottom" | "left";
  };
}

function IconButton({ children, onClick, tooltip, disabled, active }: IconButtonProps) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`icon-button ${active ? "icon-button-selected" : ""}`}>
      {children}
    </button>
  );

  if (!tooltip) {
    return button;
  }

  const { label, side } = tooltip;

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip-content" side={side} sideOffset={5}>
            {label}
            <Tooltip.Arrow className="tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export default IconButton;
