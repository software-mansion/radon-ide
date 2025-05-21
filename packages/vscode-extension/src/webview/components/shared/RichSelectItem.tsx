import React, { PropsWithChildren } from "react";
import * as Select from "@radix-ui/react-select";
import "../DeviceSelect.css";
import "./Dropdown.css";
import "./RichSelectItem.css";
import Tooltip from "./Tooltip";

interface RichSelectItemProps extends Select.SelectItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isSelected?: boolean;
}

const RichSelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<RichSelectItemProps>>(
  ({ children, icon, title, subtitle, isSelected, ...props }, forwardedRef) => {
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
      <Select.Item className="rich-item" {...props} ref={forwardedRef}>
        <div className={isSelected ? "rich-item-icon-selected" : "rich-item-icon"}>{icon}</div>
        <div>
          {isSelected ? (
            <div className="rich-item-title">
              <b>{title}</b>
            </div>
          ) : (
            <div className="rich-item-title">{title}</div>
          )}

          {renderSubtitle()}
        </div>
      </Select.Item>
    );
  }
);

export default RichSelectItem;
