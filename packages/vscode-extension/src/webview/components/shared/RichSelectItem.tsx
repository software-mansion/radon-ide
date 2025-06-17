import React, { PropsWithChildren } from "react";
import * as Select from "@radix-ui/react-select";
import "../DeviceSelect.css";
import "./Dropdown.css";
import "./RichSelectItem.css";
import Tooltip from "./Tooltip";
import { VscodeBadge as Badge } from "@vscode-elements/react-elements";

function RunningBadgeButton({ onStopClick }: { onStopClick?: (e: React.MouseEvent) => void }) {
  return (
    <div
      onPointerUpCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={onStopClick}>
      <Badge variant="activity-bar-counter" className="running-badge-button">
        <span />
      </Badge>
    </div>
  );
}

interface RichSelectItemProps extends Select.SelectItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isSelected?: boolean;
  isRunning?: boolean;
  onStopClick?: (e: React.MouseEvent) => void;
  className?: string;
}

const RichSelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<RichSelectItemProps>>(
  (
    { children, icon, title, subtitle, isSelected, isRunning, onStopClick, className, ...props },
    forwardedRef
  ) => {
    function renderSubtitle() {
      if (!subtitle) {
        return null;
      }

      const subtitleComponent = <div className="rich-item-subtitle">{subtitle}</div>;
      const isLongText = subtitle.length > 20;

      if (isLongText) {
        <Tooltip label={subtitle} side="right" instant>
          {subtitleComponent}
        </Tooltip>;
      }
      return subtitleComponent;
    }

    return (
      <Select.Item
        className={["rich-item", className].filter(Boolean).join(" ")}
        ref={forwardedRef}
        {...props}>
        <div className={isSelected ? "rich-item-icon-selected" : "rich-item-icon"}>{icon}</div>
        <div className="rich-item-content">
          <div className="rich-item-title">{isSelected ? <b>{title}</b> : title}</div>
          {renderSubtitle()}
        </div>
        {isRunning && <RunningBadgeButton onStopClick={onStopClick} />}
      </Select.Item>
    );
  }
);

export default RichSelectItem;
