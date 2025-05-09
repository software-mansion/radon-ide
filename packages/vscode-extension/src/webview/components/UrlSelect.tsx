import React, { PropsWithChildren, useEffect, useRef } from "react";
import * as Select from "@radix-ui/react-select";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { VscodeOption, VscodeSingleSelect, VscodeTextfield } from "@vscode-elements/react-elements";
import "./UrlSelect.css";

export type UrlItem = { id: string; name: string };

const SelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<Select.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => (
    <Select.Item className="url-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText style={{ width: 1 }}>
        <div className="url-select-item-text">{children}</div>
      </Select.ItemText>
    </Select.Item>
  )
);

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
  
  const [shouldFocusOnInput, setShouldFocusOnInput] = React.useState(true);

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
      <Select.Root
        value={value}
        disabled={disabled}
        open={isDropdownOpen}
        // Handle value changes from the dropdown - WORKS
        onValueChange={(value) => {
          handleValueChange(value);
          setInputValue(stripNameFromId(stripRecentPrefix(value)));
          setIsDropdownOpen(false);
        }}
      >
        <VscodeTextfield
          // @ts-ignore, no type for VscodeTextfield
          ref={textfieldRef}  
          type="text"
          data-state={isDropdownOpen ? "open" : "closed"}
          value={inputValue ?? "/"}
          placeholder="Enter path..."
          disabled={disabled}
          className="url-select-input"
          onChange={(e) => setInputValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            // Confirm the entered path and close the dropdown - WORKS
            if (e.key === "Enter") {
              e.preventDefault();
              const fieldValue = (e.target as HTMLInputElement).value;
              if (fieldValue && fieldValue !== "") {
                handleValueChange(stripNameFromId(stripRecentPrefix(fieldValue)));
              }
              setIsDropdownOpen(false);
              (e.target as HTMLInputElement).blur();
            }
            // Open the dropdown + close on arrow up in content - WIP
            if (e.key === "ArrowDown") {
              const fieldValue = (e.target as HTMLInputElement).value;
              if (fieldValue) {
                setInputValue(fieldValue);
              }
              setIsDropdownOpen(true);
            }
          }}
          // Open the dropdown on click - WORKS
          // Allow writing in the input field while the dropdown is open - WIP
          onMouseDown={(e) => {
            if (!isDropdownOpen) {
              const fieldValue = (e.target as HTMLInputElement).value;
              if (fieldValue) {
                setInputValue(fieldValue);
              }
              setIsDropdownOpen(true);
            }
            else {
              
            }
          }}

          // onBlur={(e) => {
          //   if (!isDropdownOpen) {
          //     setShouldFocusOnInput(true);
          //   }
          // }}
        />

        <Select.Trigger
          className="url-select-trigger"
          tabIndex={-1}
          // Move focus to the input if the trigger is somehow focused - WORKS
          onFocus={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = document.querySelector<HTMLSelectElement>(".url-select-input");
            if (input) {
              input.focus();
            }
          }}
        />

        <Select.Portal>

          {/* Doesn't do anything it seems like */}
          <FocusScope trapped={false}>

            <Select.Content
              className="url-select-content"
              position="popper"
              autoFocus={false}
              // Close the dropdown on outside click - WORKS
              // Don't close the dropdown on input click - WIP
              onPointerDownOutside={(e) => {
                setIsDropdownOpen(false);
                setShouldFocusOnInput(true); 
                
                // Check if the click position is within the input - if so, focus on it without closing the dropdown, else close the dropdown and set shouldFocusOnInput
                // The target happens to be <html>, so we need to get coords of the click - maybe global listener and state?
              }}
              onEscapeKeyDown={() => setIsDropdownOpen(false)}

              // Prevent focusing on the trigger->input when user clicks elsewhere - WORKS / to change later
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                setShouldFocusOnInput(true);
              }}
              // onKeyDown={(e) => {
              //   if (e.key === "ArrowUp" and what?) {   // we want to focus the input as if it was the top item but not close the dropdown
              //   setIsDropdownOpen(false);  // temp
              //   }
              // }}
              
              // Focus on the input instead of closing the dropdown - WORKS
              onFocus={() => {
                if (shouldFocusOnInput) {
                  const input = document.querySelector<HTMLInputElement>(".url-select-input");
                  if (input) {
                    input.focus();
                    setShouldFocusOnInput(false);
                  }
                }
              }}
            >
              <Select.ScrollUpButton className="url-select-scroll">
                <span className="codicon codicon-chevron-up" />
              </Select.ScrollUpButton>
              <Select.Viewport className="url-select-viewport">
                {(filteredItems && filteredItems.length > 0) || (filteredOutItems && filteredOutItems.length > 0) ? <Select.Separator className="url-select-separator no-top-margin"/> : null}

                {filteredItems && filteredItems.length > 0 ?
                  <Select.Group className="url-select-group">
                    <Select.Label className="url-select-label">Suggested paths:</Select.Label>
                    {filteredItems.map((item) =>
                      item.name && (
                        <SelectItem value={`recent#${item.id}`} key={item.id} style={{ width: textfieldWidth }}>
                          {item.name}
                        </SelectItem>
                      )
                    )}
                  </Select.Group>
                : null}
                
                {filteredItems && filteredItems.length > 0 && filteredOutItems && filteredOutItems.length > 0 ? 
                  <Select.Separator className="url-select-separator" />
                  : null}

                {filteredOutItems && filteredOutItems.length > 0 ?
                  <Select.Group className="url-select-group">
                    <Select.Label className="url-select-label">Other paths:</Select.Label>
                    {filteredOutItems.map((item) =>
                      item.name && (
                        <SelectItem value={item.id} key={item.id} style={{ width: textfieldWidth }}>
                          {item.name}
                        </SelectItem>
                      )
                    )}
                  </Select.Group>
                : null}
              </Select.Viewport>
              <Select.ScrollDownButton className="url-select-scroll">
                <span className="codicon codicon-chevron-down" />
              </Select.ScrollDownButton>
            </Select.Content>
          </FocusScope>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

export default UrlSelect;
