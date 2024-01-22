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
  const longestURl = Math.max(...items.map((item) => item.name.length));
  const urlWidth = Math.min(Math.max(longestURl * 7, 180), 280);
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
                    {item.name}
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
