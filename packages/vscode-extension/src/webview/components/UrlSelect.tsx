import React, { PropsWithChildren, useState, useEffect } from "react";
import * as Select from "@radix-ui/react-select";
import "./UrlSelect.css";

const SelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<Select.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => (
    <Select.Item className="url-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText>
        <div className="url-select-item-text">{children}</div>
      </Select.ItemText>
    </Select.Item>
  )
);

interface UrlSelectProps {
  value: string;
  onValueChange: (newValue: string) => void;
  recentItems: { id: string; name: string }[];
  items: { id: string; name: string }[];
  disabled?: boolean;
}

function UrlSelect({ onValueChange, recentItems, items, value, disabled }: UrlSelectProps) {
  // We use two lists for URL selection: one with recently used URLs and another
  // with all available URLs. Since recentItems is a subset of items, each recentItems's
  // value is prefixed to differentiate their origins when presented in the Select
  // component. This prefix is stripped off when the selected value is passed back
  // through onValueChange.
  const maxLineLenght = 37; // maximum length for an item name without truncation
  const longestURl = Math.max(...items.map((item) => item.name.length));
  const urlWidth = Math.min(Math.max(longestURl * 7, 180), 280);

  const handleValueChange = (newValue: string) => {
    const dashIndex = newValue.indexOf("#");
    const strippedValue = dashIndex === -1 ? newValue : newValue.substring(dashIndex + 1);
    console.log("FRYTKI strippedValue", strippedValue);
    onValueChange(strippedValue);
  };

  function splitLines(text: string) {
    // Reformats text to max 37 characters per line, breaking at last dash if possible.
    const findBreakPoint = (chunk: string, startIndex: number): number => {
      const lastDash = chunk.lastIndexOf("-");
      if (lastDash !== -1) {
        return lastDash + 1 + startIndex;
      }
      return Math.min(startIndex + maxLineLenght, text.length);
    };

    let result = "";
    let startIndex = 0;
    while (startIndex < text.length) {
      if (startIndex + maxLineLenght > text.length) {
        result += text.substring(startIndex);
        break;
      }
      let chunk = text.substring(startIndex, startIndex + maxLineLenght);
      let nextBreakPoint = findBreakPoint(chunk, startIndex);
      result += text.substring(startIndex, nextBreakPoint) + "\n";
      startIndex = nextBreakPoint;
    }
    return result.trim();
  }

  return (
    <Select.Root onValueChange={handleValueChange} value={value} disabled={disabled}>
      <Select.Trigger className="url-select-trigger" style={{ width: urlWidth }}>
        <Select.Value placeholder="/" aria-label={value}></Select.Value>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="url-select-content"
          position="popper"
          style={{ width: urlWidth }}>
          <Select.Viewport className="url-select-viewport">
            <Select.Group>
              <Select.Label className="url-select-label">Recently used:</Select.Label>
              {recentItems.map(
                (item) =>
                  item.name && (
                    <SelectItem value={`recent#${item.id}`} key={item.id}>
                      {item.name.length > maxLineLenght ? splitLines(item.name) : item.name}
                    </SelectItem>
                  )
              )}
            </Select.Group>
            <Select.Separator className="url-select-separator" />
            <Select.Group>
              <Select.Label className="url-select-label">All paths:</Select.Label>
              {items.map(
                (item) =>
                  item.name && (
                    <SelectItem value={item.id} key={item.id}>
                      {item.name.length > maxLineLenght ? splitLines(item.name) : item.name}
                    </SelectItem>
                  )
              )}
            </Select.Group>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default UrlSelect;
