import React, { PropsWithChildren, useEffect, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { VscodeOption, VscodeSingleSelect, VscodeTextfield } from "@vscode-elements/react-elements";
import "./UrlSelect.css";

export type UrlItem = { id: string; name: string };

const PopoverItem = React.forwardRef<HTMLDivElement, PropsWithChildren<{
  value: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}>>(({ children, onClick, ...props }, forwardedRef) => (
  <div className="url-select-item" {...props} ref={forwardedRef} onClick={onClick}>
    <div className="url-select-item-text">{children}</div>
  </div>
));

interface UrlSelectProps {
  value: string;
  onValueChange: (newValue: string) => void;
  recentItems: UrlItem[];
  items: UrlItem[];
  disabled?: boolean;
}

function UrlSelect({ onValueChange, recentItems, items, value, disabled }: UrlSelectProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [filteredItems, setFilteredItems] = React.useState<UrlItem[]>([]);
  const [filteredOutItems, setFilteredOutItems] = React.useState<UrlItem[]>([]);

  const [textfieldWidth, setTextfieldWidth] = React.useState<number>(0);
  const textfieldRef = useRef<HTMLInputElement>(null);

  // TODO CHANGE THIS BELOW
  // We use two lists for URL selection: one with recently used URLs and another
  // with all available URLs. Since recentItems is a subset of items, each recentItems's
  // value is prefixed to differentiate their origins when presented in the Select
  // component. This prefix is stripped off when the selected value is passed back
  // through onValueChange.

  const handleValueChange = (newSelection: string) => {
    onValueChange(stripRecentPrefix(newSelection));
  };

  const stripRecentPrefix = (id: string) => {
    return id.replace(/^recent#/, "");
  };

  const stripNameFromId = (id: string) => {
    const item = items.find((item) => item.id === id);
    if (item) {
      return item.name;
    }
    return id;
  };

  useEffect(() => {
    setInputValue(stripNameFromId(value));
  }, [value]);

  useEffect(() => {
    if (!disabled) {
      const filtered = items.filter((item) => item.name.toLowerCase().includes(inputValue.toLowerCase()));
      setFilteredItems(filtered);
    }
  }, [inputValue, items]);

  useEffect(() => {
    const filteredOut = items.filter((item) => !filteredItems.some((filteredItem) => filteredItem.id === item.id));
    setFilteredOutItems(filteredOut);
  }, [items, filteredItems]);

  useEffect(() => {
    if (textfieldRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          if (entry.contentRect) {
            setTextfieldWidth(entry.contentRect.width);
          }
        }
      });

      resizeObserver.observe(textfieldRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);


  return (
    <div className="url-select-wrapper">
      <Popover.Root open={isDropdownOpen}>
        <Popover.Trigger asChild>
          <VscodeTextfield
            // @ts-ignore, no type for VscodeTextfield
            ref={textfieldRef}  
            type="text"
            data-state={isDropdownOpen ? "open" : "closed"}
            value={inputValue ?? "/"}
            placeholder="Enter path..."
            disabled={disabled}
            className="url-select-input"
            onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const fieldValue = (e.target as HTMLInputElement).value;
                if (fieldValue && fieldValue !== "") {
                  handleValueChange(stripNameFromId(stripRecentPrefix(fieldValue)));
                }
                setIsDropdownOpen(false);
                (e.target as HTMLInputElement).blur();
              }
              // WIP rn
              if (e.key === "ArrowDown") {
                const fieldValue = (e.target as HTMLInputElement).value;
                if (fieldValue) {
                  setInputValue(fieldValue);
                }
                setIsDropdownOpen(true);
              }
            }}
            onMouseDown={(e) => {
              if (!isDropdownOpen) {
                const fieldValue = (e.target as HTMLInputElement).value;
                if (fieldValue) {
                  setInputValue(fieldValue);
                }
                setIsDropdownOpen(true);
              }
            }}
          />
        </Popover.Trigger>
        <Popover.Content
          className="url-select-content"
          side="bottom"
          onEscapeKeyDown={() => setIsDropdownOpen(false)}
          onPointerDownOutside={(e) => {
            const originalEvent = e.detail.originalEvent as PointerEvent;
            const input = textfieldRef.current;
            if (input) {
              const inputRect = input.getBoundingClientRect();
              if (
                originalEvent.clientX >= inputRect.left &&
                originalEvent.clientX <= inputRect.right &&
                originalEvent.clientY >= inputRect.top &&
                originalEvent.clientY <= inputRect.bottom
              ) return;
            }
            setIsDropdownOpen(false);
          }}
        >
          <div className="url-select-viewport">
            {(filteredItems.length > 0 || filteredOutItems.length > 0) && (
              <div className="url-select-separator no-top-margin" />
            )}

            {filteredItems.length > 0 && (
              <div className="url-select-group">
                <div className="url-select-label">Suggested paths:</div>
                {filteredItems.map((item) =>
                  item.name && (
                    <PopoverItem
                      key={item.id}
                      value={`recent#${item.id}`}
                      style={{ width: textfieldWidth }}
                      onClick={() => {
                        handleValueChange(`recent#${item.id}`);
                        setInputValue(item.name);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {item.name}
                    </PopoverItem>
                  )
                )}
              </div>
            )}

            {filteredItems.length > 0 && filteredOutItems.length > 0 && (
              <div className="url-select-separator" />
            )}

            {filteredOutItems.length > 0 && (
              <div className="url-select-group">
                <div className="url-select-label">Other paths:</div>
                {filteredOutItems.map((item) =>
                  item.name && (
                    <PopoverItem
                      key={item.id}
                      value={item.id}
                      style={{ width: textfieldWidth }}
                      onClick={() => {
                        handleValueChange(item.id);
                        setInputValue(item.name);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {item.name}
                    </PopoverItem>
                  )
                )}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}

export default UrlSelect;
