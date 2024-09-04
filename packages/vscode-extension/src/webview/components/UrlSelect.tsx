import React, { PropsWithChildren, useState, useEffect } from "react";
import * as Select from "@radix-ui/react-select";
import "./UrlSelect.css";

export type UrlItem = { id: string; name: string };

const SelectItem = React.forwardRef<
  HTMLDivElement,
  PropsWithChildren<Select.SelectItemProps & { urlWidth: number }>
>(({ children, urlWidth, ...props }, forwardedRef) => {
  const itemStyle = { maxWidth: urlWidth - 20 };
  return (
    <Select.Item className="url-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText>
        <div className="url-select-item-text" style={itemStyle}>
          {children}
        </div>
      </Select.ItemText>
    </Select.Item>
  );
});

interface UrlSelectProps {
  value: string;
  onValueChange: (newValue: string) => void;
  recentItems: UrlItem[];
  items: UrlItem[];
  disabled?: boolean;
}

function UrlSelect({ onValueChange, recentItems, items, value, disabled }: UrlSelectProps) {
  // We use two lists for URL selection: one with recently used URLs and another
  // with all available URLs. Since recentItems is a subset of items, each recentItems's
  // value is prefixed to differentiate their origins when presented in the Select
  // component. This prefix is stripped off when the selected value is passed back
  // through onValueChange.
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const longestUrl = Math.max(...items.map((item) => item.name.length));
  let urlWidth = Math.min(Math.max(longestUrl * 7.5, 180), windowWidth * 0.6);
  const maxCharsInSingleLine = Math.floor(urlWidth / 7.5);

  const handleValueChange = (newSelection: string) => {
    const stripped = newSelection.replace(/^recent#/, "");
    onValueChange(stripped);
  };

  const handleResize = () => {
    setWindowWidth(window.innerWidth);
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  function splitLines(text: string) {
    // Reformats text to max line length characters per line, breaking at last special char if possible.
    const findBreakPoint = (chunk: string, startIndex: number) => {
      const specialChars = "-+=?&#";
      let lastSpecialCharIndex = -1;
      for (let i = 0; i < specialChars.length; i++) {
        const currentCharIndex = chunk.lastIndexOf(specialChars[i]);
        if (currentCharIndex > lastSpecialCharIndex) {
          lastSpecialCharIndex = currentCharIndex;
        }
      }
      if (lastSpecialCharIndex !== -1) {
        return lastSpecialCharIndex + 1 + startIndex;
      }
      return Math.min(startIndex + maxCharsInSingleLine, text.length);
    };

    let result = "";
    let startIndex = 0;
    while (startIndex < text.length) {
      if (startIndex + maxCharsInSingleLine > text.length) {
        result += text.substring(startIndex);
        break;
      }
      const chunk = text.substring(startIndex, startIndex + maxCharsInSingleLine);
      const nextBreakPoint = findBreakPoint(chunk, startIndex);
      result += text.substring(startIndex, nextBreakPoint) + "\n";
      startIndex = nextBreakPoint;
    }
    return result.trim();
  }

  return (
    <Select.Root onValueChange={handleValueChange} value={value} disabled={disabled}>
      <Select.Trigger className="url-select-trigger" style={{ width: urlWidth }}>
        <Select.Value placeholder="/" aria-label={value} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="url-select-content"
          position="popper"
          style={{ width: urlWidth }}>
          <Select.ScrollUpButton className="url-select-scroll">
            <span className="codicon codicon-chevron-up" />
          </Select.ScrollUpButton>
          <Select.Viewport className="url-select-viewport">
            <Select.Group>
              <Select.Label className="url-select-label">Recently used:</Select.Label>
              {recentItems.map(
                (item) =>
                  item.name && (
                    <SelectItem value={`recent#${item.id}`} key={item.id} urlWidth={urlWidth}>
                      {item.name.length > maxCharsInSingleLine ? splitLines(item.name) : item.name}
                    </SelectItem>
                  )
              )}
            </Select.Group>
            <Select.Separator className="url-select-separator" />
            <Select.Group>
              <Select.Label className="url-select-label">All visited paths:</Select.Label>
              {items.map(
                (item) =>
                  item.name && (
                    <SelectItem value={item.id} key={item.id} urlWidth={urlWidth}>
                      {item.name.length > maxCharsInSingleLine ? splitLines(item.name) : item.name}
                    </SelectItem>
                  )
              )}
            </Select.Group>
          </Select.Viewport>
          <Select.ScrollDownButton className="url-select-scroll">
            <span className="codicon codicon-chevron-down" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default UrlSelect;
