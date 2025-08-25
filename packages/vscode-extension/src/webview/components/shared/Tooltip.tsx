import * as RadixTooltip from "@radix-ui/react-tooltip";
import "./Tooltip.css";
import classnames from "classnames";

interface TooltipProps {
  children: React.ReactNode;
  label: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  type?: "primary" | "secondary" | "ternary" | "submit";
  instant?: boolean;
  disabled?: boolean;
}

export default function Tooltip({
  children,
  label,
  side = "top",
  type = "primary",
  instant = false,
  disabled = false,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root delayDuration={instant ? 0 : 700}>
        <RadixTooltip.Trigger asChild>
          {/* Some elements may have `pointer-events: none` set in css when disabled,
          so if we wish to show label, we've got to have an element 
          (in this case <span>), which can react to pointer events. If
          one wishes to disable the Tooltip when `pointer-events: none` is set
          they should declare this explicitly setting the `disabled` prop on the
          Tooltip component. */}
          <span>{children}</span>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            style={{ display: disabled ? "none" : "block" }}
            className={classnames(
              "tooltip-content",
              type === "primary" && "tooltip-primary",
              type === "secondary" && "tooltip-secondary",
              type === "ternary" && "tooltip-ternary"
            )}
            side={side}
            sideOffset={5}>
            {label}
            <RadixTooltip.Arrow
              style={{ display: disabled ? "none" : "block" }}
              className={classnames(
                "tooltip-arrow",
                type === "secondary" && "tooltip-arrow-secondary",
                type === "ternary" && "tooltip-arrow-ternary"
              )}
            />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
