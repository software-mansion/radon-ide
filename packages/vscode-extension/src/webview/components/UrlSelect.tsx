import React, { PropsWithChildren, useEffect, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { VscodeTextfield } from "@vscode-elements/react-elements";
import "./UrlSelect.css";

export type UrlItem = { id: string; name: string };

interface PopoverItemProps {
  item: UrlItem;
  width: number;
  style?: React.CSSProperties;
  textfieldRef: React.RefObject<HTMLInputElement>;
  onClose: (id: string) => void;
  onNavigate: (
    e: React.KeyboardEvent,
    prev?: UrlSelectFocusable,
    next?: UrlSelectFocusable,
    prevFallback?: UrlSelectFocusable,
    nextFallback?: UrlSelectFocusable
  ) => void;
  getNameFromId: (id: string) => string;
}

const PopoverItem = React.forwardRef<HTMLDivElement, PropsWithChildren<PopoverItemProps>>(
  (
    { children, style, item, textfieldRef, width, onClose, onNavigate, getNameFromId, ...props },
    forwardedRef
  ) => (
    <div
      {...props}
      tabIndex={0}
      ref={forwardedRef}
      className="url-select-item"
      style={{ ...style, width: width }}
      onClick={() => onClose(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onClose(item.id);
        } else {
          onNavigate(
            e,
            (e.target as HTMLDivElement).previousElementSibling as HTMLDivElement,
            (e.target as HTMLDivElement).nextElementSibling as HTMLDivElement,
            textfieldRef.current as HTMLInputElement,
            document.querySelector(".url-select-group-other .url-select-item") as HTMLDivElement
          );
        }
      }}>
      <div className="url-select-item-text">{getNameFromId(item.id)}</div>
    </div>
  )
);

interface UrlSelectProps {
  value: string;
  onValueChange: (newValue: string) => void;
  recentItems: UrlItem[];
  items: UrlItem[];
  disabled?: boolean;
}

type UrlSelectFocusable = HTMLDivElement | HTMLInputElement;

// Currently, recentItems are not used, but they can be mapped to show the most recent
// URLs in the dropdown. This can be implemented in the future if needed.
function UrlSelect({ onValueChange, recentItems, items, value, disabled }: UrlSelectProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [filteredItems, setFilteredItems] = React.useState<UrlItem[]>([]);
  const [filteredOutItems, setFilteredOutItems] = React.useState<UrlItem[]>([]);

  const [textfieldWidth, setTextfieldWidth] = React.useState<number>(0);
  const textfieldRef = useRef<HTMLInputElement>(null);

  const getNameFromId = (id: string) => {
    const item = items.find((item) => item.id === id);
    if (!item) {
      return id;
    }
    if (item.name.startsWith("/")) {
      return item.name;
    }
    return item.id;
  };

  const closeDropdownWithValue = (id: string) => {
    setInputValue(getNameFromId(id));
    onValueChange(id);
    setIsDropdownOpen(false);
  };

  const navigateBetweenItems = (
    e: React.KeyboardEvent,
    prev?: UrlSelectFocusable,
    next?: UrlSelectFocusable,
    prevFallback?: UrlSelectFocusable,
    nextFallback?: UrlSelectFocusable
  ) => {
    e.preventDefault();
    let targetItem = null;
    let targetItemFallback = null;
    if (e.key === "ArrowDown") {
      targetItem = next;
      targetItemFallback = nextFallback;
    } else if (e.key === "ArrowUp") {
      targetItem = prev;
      targetItemFallback = prevFallback;
    }
    if (
      targetItem &&
      (targetItem.classList.contains("url-select-item") ||
        targetItem.classList.contains("url-select-input"))
    ) {
      targetItem.focus();
    } else if (targetItemFallback) {
      targetItemFallback.focus();
    } else {
      textfieldRef.current?.focus();
    }
  };

  useEffect(() => {
    setInputValue(getNameFromId(value));
  }, [value]);

  useEffect(() => {
    if (!disabled) {
      const inputValueLowerCase = inputValue.toLowerCase();
      const filtered = items.filter((item) =>
        getNameFromId(item.id).toLowerCase().includes(inputValueLowerCase)
      );
      setFilteredItems(filtered);
    }
  }, [inputValue, items]);

  useEffect(() => {
    const filteredOut = items.filter(
      (item) => !filteredItems.some((filteredItem) => filteredItem.id === item.id)
    );
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
      return () => resizeObserver.disconnect();
    }
  }, []);

  return (
    <div className="url-select-wrapper">
      <Popover.Root open={isDropdownOpen}>
        <Popover.Trigger asChild>
          <VscodeTextfield
            // @ts-ignore, no type for VscodeTextfield
            ref={textfieldRef}
            className="url-select-input"
            data-state={isDropdownOpen ? "open" : "closed"}
            value={inputValue ?? "/"}
            placeholder="Enter path..."
            disabled={disabled}
            onInput={() => setInputValue(textfieldRef.current?.value ?? "")}
            onMouseDown={() => setIsDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                closeDropdownWithValue(textfieldRef.current?.value ?? "");
                textfieldRef.current?.blur();
              }
              if (e.key === "Escape") {
                setIsDropdownOpen(false);
                textfieldRef.current?.blur();
              }
              if (e.key === "ArrowDown") {
                if (isDropdownOpen) {
                  navigateBetweenItems(
                    e,
                    undefined,
                    document.querySelector(".url-select-item") as HTMLDivElement
                  );
                } else {
                  setIsDropdownOpen(true);
                }
              }
            }}
          />
        </Popover.Trigger>

        <Popover.Content
          className="url-select-content"
          side="bottom"
          onEscapeKeyDown={() => setIsDropdownOpen(false)}
          onPointerDownOutside={(e) => {
            const input = textfieldRef.current;
            const originalEvent = e.detail.originalEvent as PointerEvent;
            const elemRect = textfieldRef.current?.getBoundingClientRect();
            if (
              !input ||
              !elemRect ||
              originalEvent.clientX <= elemRect.left ||
              originalEvent.clientX >= elemRect.right ||
              originalEvent.clientY <= elemRect.top ||
              originalEvent.clientY >= elemRect.bottom
            ) {
              setIsDropdownOpen(false);
            }
          }}>
          <div className="url-select-viewport">
            {(filteredItems.length > 0 || filteredOutItems.length > 0) && (
              <div className="url-select-separator no-top-margin" />
            )}

            {filteredItems.length > 0 && (
              <div className="url-select-group url-select-group-suggested">
                <div className="url-select-label">Suggested paths:</div>
                {filteredItems.map(
                  (item) =>
                    item.name && (
                      <PopoverItem
                        item={item}
                        key={item.id}
                        width={textfieldWidth}
                        onClose={closeDropdownWithValue}
                        onNavigate={navigateBetweenItems}
                        getNameFromId={getNameFromId}
                        textfieldRef={textfieldRef as React.RefObject<HTMLInputElement>}
                      />
                    )
                )}
              </div>
            )}

            {filteredItems.length > 0 && filteredOutItems.length > 0 && (
              <div className="url-select-separator" />
            )}

            {filteredOutItems.length > 0 && (
              <div className="url-select-group url-select-group-other">
                <div className="url-select-label">Other paths:</div>
                {filteredOutItems.map(
                  (item) =>
                    item.name && (
                      <PopoverItem
                        item={item}
                        key={item.id}
                        width={textfieldWidth}
                        onClose={closeDropdownWithValue}
                        onNavigate={navigateBetweenItems}
                        getNameFromId={getNameFromId}
                        textfieldRef={textfieldRef as React.RefObject<HTMLInputElement>}
                      />
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
