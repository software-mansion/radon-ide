import * as RadixTooltip from "@radix-ui/react-tooltip";
import "./Tooltip.css";
import classnames from "classnames";

interface TooltipProps {
  children: React.ReactNode;
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  type?: "primary" | "secondary" | "ternary" | "submit";
  instant?: boolean;
}

export default function Tooltip({
  children,
  label,
  side = "top",
  type = "primary",
  instant = false,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root delayDuration={instant ? 0 : 700}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
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
