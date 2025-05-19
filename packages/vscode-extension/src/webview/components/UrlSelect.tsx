import React, { PropsWithChildren, useEffect, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { VscodeTextfield } from "@vscode-elements/react-elements";
import { partition, differenceBy } from "lodash";
import { Route, useRoutes, useRoutesAsItems } from "../providers/RoutesProvider";
import UrlSelectItem from "./UrlSelectItem";
import "./UrlSelect.css";
import { useProject } from "../providers/ProjectProvider";

export type UrlItem = { id: string; name: string; dynamic?: boolean };
export type UrlSelectFocusable = HTMLDivElement | HTMLInputElement;

interface UrlSelectProps {
  value?: string;
  onValueChange: (newValue: string) => void;
  recentItems: UrlItem[];
  items: UrlItem[];
  disabled?: boolean;
  dropdownOnly?: boolean;
}

function UrlSelect({
  onValueChange,
  recentItems,
  items,
  value,
  disabled,
  dropdownOnly,
}: UrlSelectProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("/");
  const [allItems, setAllItems] = React.useState<UrlItem[]>([]);
  const [filteredItems, setFilteredItems] = React.useState<UrlItem[]>([]);
  const [filteredOutItems, setFilteredOutItems] = React.useState<UrlItem[]>([]);
  const [textfieldWidth, setTextfieldWidth] = React.useState<number>(0);
  const textfieldRef = useRef<HTMLInputElement>(null);

  const routes = useRoutes();
  const routeItems = useRoutesAsItems();

  const itemRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
  const { project } = useProject();

  const getNameFromId = (id: string) => {
    const itemForID = items.find((item) => item.id === id);
    if (!itemForID) {
      return id;
    }
    return itemForID.name;
  };

  const checkIsPathDynamic = (item: UrlItem) => {
    const route = routes.find((route) => route.path === item.id);
    if (route && route.dynamic) {
      return true;
    }
    return false;
  };

  const closeDropdownWithValue = (id: string) => {
    if (checkIsPathDynamic({ id, name: id })) {
      editDynamicPath(id);
      return;
    }
    setInputValue(getNameFromId(id));
    onValueChange(id);
    setIsDropdownOpen(false);
  };

  const editDynamicPath = (id: string) => {
    setInputValue(getNameFromId(id));
    textfieldRef.current?.focus();
    if (textfieldRef.current && textfieldRef.current.tagName === "INPUT") {
      textfieldRef.current.setSelectionRange(0, id.length);
    }
  };

  const navigateBetweenItems = (
    e: React.KeyboardEvent,
    prev?: UrlSelectFocusable,
    next?: UrlSelectFocusable
  ) => {
    e.preventDefault();
    let targetItem = null;
    if (e.key === "ArrowDown") {
      targetItem = next;
    } else if (e.key === "ArrowUp") {
      targetItem = prev;
    }
    if (
      targetItem &&
      (targetItem.classList.contains("url-select-item") ||
        targetItem.classList.contains("url-select-input"))
    ) {
      targetItem.focus();
    } else {
      textfieldRef.current?.focus();
    }
  };

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(getNameFromId(value));
    }
  }, [value]);

  useEffect(() => {
    itemRefs.current = [...filteredItems, ...filteredOutItems].map(
      (_, i) => itemRefs.current[i] || React.createRef<HTMLDivElement>()
    );
  }, [allItems, filteredItems]);

  useEffect(() => {
    const routesNotInRecent = differenceBy(routeItems, recentItems, (item: UrlItem) =>
      getNameFromId(item.id)
    );
    const allItems = [...recentItems, ...routesNotInRecent];
    setAllItems(allItems);
  }, [inputValue, recentItems]);

  useEffect(() => {
    if (disabled) {
      setFilteredItems([]);
      return;
    }
    const inputValueLowerCase = inputValue?.toLowerCase();
    const [filtered, filteredOut] = partition(allItems, (item) =>
      item.name?.toLowerCase().includes(inputValueLowerCase)
    );
    setFilteredItems(filtered);
    setFilteredOutItems(filteredOut);
  }, [inputValue, allItems, disabled]);

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
            readonly={dropdownOnly}
            onInput={() => setInputValue(textfieldRef.current?.value ?? "")}
            onFocus={() => setIsDropdownOpen(true)}
            onMouseDown={() => {
              if (!isDropdownOpen && !dropdownOnly) {
                setTimeout(() => textfieldRef.current?.focus(), 0);
              } else if (dropdownOnly) {
                setIsDropdownOpen(!isDropdownOpen);
                textfieldRef.current?.blur();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
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
                }
              }
            }}
          />
        </Popover.Trigger>

        <Popover.Content
          className="url-select-content"
          side="bottom"
          style={{ width: textfieldWidth + 20 }}
          onEscapeKeyDown={() => setIsDropdownOpen(false)}
          onPointerDownOutside={(e) => {
            const input = textfieldRef.current;
            const originalEvent = e.detail.originalEvent as PointerEvent;
            const elemRect = textfieldRef.current?.getBoundingClientRect();
            if (
              dropdownOnly ||
              !input ||
              !elemRect ||
              originalEvent.clientX <= elemRect.left ||
              originalEvent.clientX >= elemRect.right ||
              originalEvent.clientY <= elemRect.top ||
              originalEvent.clientY >= elemRect.bottom
            ) {
              setIsDropdownOpen(false);
              input?.blur();
            }
          }}>

          {(filteredItems.length > 0 || filteredOutItems.length > 0) && (
            <div className="url-select-separator-top" />
          )}

          <div className="url-select-viewport">
            {dropdownOnly ? (
              <div className="url-select-group">
                <div className="url-select-label">Recent paths:</div>
                <UrlSelectItem
                  item={{ id: "/", name: "/" }}
                  index={1}
                  width={textfieldWidth}
                  onClose={() => {
                    setInputValue("/");
                    setIsDropdownOpen(false);
                    project.goHome("/{}");
                  }}
                  onNavigate={navigateBetweenItems}
                  getNameFromId={getNameFromId}
                  itemRefs={itemRefs.current}
                  textfieldRef={textfieldRef as React.RefObject<HTMLInputElement>}
                />

                {recentItems.map(
                  (item, index) =>
                    item.name && (
                      <UrlSelectItem
                        item={item}
                        index={index}
                        key={item.id}
                        width={textfieldWidth}
                        onClose={closeDropdownWithValue}
                        onNavigate={navigateBetweenItems}
                        getNameFromId={getNameFromId}
                        itemRefs={itemRefs.current}
                        textfieldRef={textfieldRef as React.RefObject<HTMLInputElement>}
                      />
                    )
                )}

                {items
                  .filter((item) => !recentItems.some((recentItem) => recentItem.id === item.id))
                  .map(
                    (item, index) =>
                      item.name && (
                        <UrlSelectItem
                          ref={itemRefs.current[index]}
                          item={item}
                          index={index}
                          key={item.id}
                          width={textfieldWidth}
                          onClose={closeDropdownWithValue}
                          onNavigate={navigateBetweenItems}
                          getNameFromId={getNameFromId}
                          itemRefs={itemRefs.current}
                          textfieldRef={textfieldRef as React.RefObject<HTMLInputElement>}
                        />
                      )
                  )}
              </div>
            ) : (
              <>
                {filteredItems.length > 0 && (
                  <div className="url-select-group url-select-group-suggested">
                    <div className="url-select-label">Suggested paths:</div>
                    {filteredItems.map(
                      (item, index) =>
                        item.name && (
                          <UrlSelectItem
                            ref={itemRefs.current[index]}
                            item={item}
                            index={index}
                            key={item.id}
                            width={textfieldWidth}
                            onClose={closeDropdownWithValue}
                            onNavigate={navigateBetweenItems}
                            getNameFromId={getNameFromId}
                            itemRefs={itemRefs.current}
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
                    {filteredOutItems.map(
                      (item, index) =>
                        item.name && (
                          <UrlSelectItem
                            ref={itemRefs.current[index + filteredItems.length]}
                            item={item}
                            index={index + filteredItems.length}
                            key={item.id}
                            width={textfieldWidth}
                            onClose={closeDropdownWithValue}
                            onNavigate={navigateBetweenItems}
                            getNameFromId={getNameFromId}
                            itemRefs={itemRefs.current}
                            textfieldRef={textfieldRef as React.RefObject<HTMLInputElement>}
                          />
                        )
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}

export default UrlSelect;
