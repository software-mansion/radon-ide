import React, { PropsWithChildren } from "react";
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
  items: { id: string; name: string }[];
  disabled?: boolean;
}

function UrlSelect({ onValueChange, items, value, disabled }: UrlSelectProps) {
  const maxLineLenght = 37; // maximum length for an item name without truncation
  const longestURl = Math.max(...items.map((item) => item.name.length));
  const urlWidth = Math.min(Math.max(longestURl * 7, 180), 280);

// Reformats text to max 37 characters per line, breaking at last dash if possible.
  function splitLines(text: string): string {
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
    <Select.Root onValueChange={onValueChange} value={value} disabled={disabled}>
      <Select.Trigger className="url-select-trigger" style={{ width: urlWidth }}>
        <Select.Value placeholder="/" aria-label={value} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="url-select-content"
          position="popper"
          style={{ width: urlWidth }}>
          <Select.Viewport className="url-select-viewport">
            {items.map(
              (item) =>
                item.name && (
                  <SelectItem value={item.id} key={item.id}>
                    {item.name.length > maxLineLenght ? splitLines(item.name) : item.name}
                  </SelectItem>
                )
            )}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default UrlSelect;
