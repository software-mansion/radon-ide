import React, { useEffect, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { VscodeTextfield } from "@vscode-elements/react-elements";
import { partition, differenceBy } from "lodash";
import { useRoutes, useRoutesAsItems } from "../providers/RoutesProvider";
import UrlSelectItem from "./UrlSelectItem";
import UrlSelectItemGroup from "./UrlSelectItemGroup";
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
  const [allItems, setAllItems] = React.useState<UrlItem[]>([]);
  const [filteredItems, setFilteredItems] = React.useState<UrlItem[]>([]);
  const [filteredOutItems, setFilteredOutItems] = React.useState<UrlItem[]>([]);
  const [inputValue, setInputValue] = React.useState("/");
  const [dynamicSegmentNames, setDynamicSegmentNames] = React.useState<string[]>([]);
  const [currentDynamicSegment, setCurrentDynamicSegment] = React.useState<number>(0);
  const [textfieldWidth, setTextfieldWidth] = React.useState<number>(0);
  const textfieldRef = useRef<HTMLInputElement>(null);

  const routes = useRoutes();
  const routeItems = useRoutesAsItems();

  const itemsRef = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
  const { project } = useProject();

  const getNameFromId = (id: string) => {
    const itemForID = items.find((item) => item.id === id);
    if (!itemForID) {
      return id;
    }
    return itemForID.name;
  };

  const findDynamicSegments = (item: UrlItem) => {
    const matchingRoute = routes.find((route) => route.path === item.id);
    if (matchingRoute && matchingRoute.dynamic) {
      return matchingRoute.dynamic.map((segment) => segment.name);
    }
    return null;
  };

  const closeDropdownWithValue = (id: string) => {
    const dynamicSegments = findDynamicSegments({ id, name: id });
    if (dynamicSegments && dynamicSegments.length > 0) {
      editDynamicPath(id, dynamicSegments);
      return;
    }
    setInputValue(getNameFromId(id));
    onValueChange(id);
    setIsDropdownOpen(false);
    setDynamicSegmentNames([]);
    setCurrentDynamicSegment(0);
    setTimeout(() => textfieldRef.current?.blur(), 0);
  };

  const editDynamicPath = (id: string, segmentNames: string[]) => {
    setInputValue(getNameFromId(id));
    setDynamicSegmentNames(segmentNames);
    setCurrentDynamicSegment(0);
    setTimeout(() => {
      textfieldRef.current?.focus();
      selectCurrentDynamicSegment(segmentNames, 0);
    }, 0);
  };

  const selectCurrentDynamicSegment = (segmentNames: string[], index: number) => {
    const shadowInput = textfieldRef.current?.shadowRoot?.querySelector("input");
    if (!shadowInput || !segmentNames[index]) {
      return;
    }
    const segmentName = segmentNames[index];
    const fieldValue = textfieldRef.current?.value ?? "";
    const regex = new RegExp(`\\[${segmentName}\\]`, "g");
    const match = regex.exec(fieldValue);
    if (match) {
      shadowInput.setSelectionRange(match.index, match.index + match[0].length);
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

  // Props for UrlSelectItems and UrlSelectItemGroups to reduce code duplication
  const commonItemProps = {
    width: textfieldWidth,
    itemsRef: itemsRef.current,
    textfieldRef: textfieldRef as React.RefObject<HTMLInputElement>,
    onNavigate: navigateBetweenItems,
    getNameFromId,
  };

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(getNameFromId(value));
    }
  }, [value]);

  // Update the itemsRef to ensure all items are focused correctly
  useEffect(() => {
    itemsRef.current = [
      ...(dropdownOnly ? [{ id: "/", name: "/" }] : []),
      ...filteredItems,
      ...filteredOutItems,
    ].map((_, i) => itemsRef.current[i] || React.createRef<HTMLDivElement>());
  }, [allItems, filteredItems]);

  // Update the combined recent/indexed route list
  useEffect(() => {
    const routesNotInRecent = differenceBy(routeItems, recentItems, (item: UrlItem) =>
      getNameFromId(item.id)
    );
    const combinedItems = [...recentItems, ...routesNotInRecent];
    setAllItems(combinedItems);
  }, [inputValue, recentItems]);

  // Update the filtered items based on the input value
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

  // Update the dynamic segments to be highlighted/editable
  useEffect(() => {
    if (dynamicSegmentNames.length > 0) {
      selectCurrentDynamicSegment(dynamicSegmentNames, currentDynamicSegment);
    }
  }, [currentDynamicSegment, dynamicSegmentNames, inputValue]);

  // Watch the width of the textfield to adjust the dropdown width
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

  // Hacky way to change the cursor style of a readonly input,
  // since the VscodeTextfield component doesn't provide any parts
  // or props, and according to the authors, it's not going to.
  useEffect(() => {
    if (textfieldRef.current && textfieldRef.current.shadowRoot) {
      const style = document.createElement("style");
      style.textContent = "input[readonly] { cursor: text !important; }";
      textfieldRef.current.shadowRoot.appendChild(style);
    }
  }, [dropdownOnly]);

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
                setTimeout(() => textfieldRef.current?.blur(), 0);
              }
            }}
            onKeyDown={(e) => {
              if (dynamicSegmentNames.length > 0 && e.key === "Tab") {
                e.preventDefault();
                if (e.shiftKey && currentDynamicSegment > 0) {
                  setCurrentDynamicSegment(currentDynamicSegment - 1);
                } else if (!e.shiftKey && currentDynamicSegment < dynamicSegmentNames.length - 1) {
                  setCurrentDynamicSegment(currentDynamicSegment + 1);
                }
              }
              if (e.key === "Enter") {
                closeDropdownWithValue(textfieldRef.current?.value ?? "");
              }
              if (e.key === "Escape") {
                setIsDropdownOpen(false);
                setTimeout(() => textfieldRef.current?.blur(), 0);
              }
              if (e.key === "ArrowDown") {
                if (isDropdownOpen) {
                  navigateBetweenItems(
                    e,
                    undefined,
                    itemsRef.current[0]?.current as UrlSelectFocusable
                  );
                }
              }
            }}
          />
        </Popover.Trigger>

        <Popover.Content
          className="url-select-content"
          side="bottom"
          style={{ width: textfieldWidth + 16 }}
          onEscapeKeyDown={() => {
            setIsDropdownOpen(false);
            setTimeout(() => textfieldRef.current?.blur(), 0);
          }}
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
                  ref={itemsRef.current[0]}
                  refIndex={0}
                  onClose={() => {
                    setInputValue("/");
                    setIsDropdownOpen(false);
                    project.goHome("/{}");
                  }}
                  {...commonItemProps}
                  noHighlight={true}
                />

                <UrlSelectItemGroup
                  items={recentItems}
                  refIndexOffset={1}
                  onClose={closeDropdownWithValue}
                  noHighlight={true}
                  {...commonItemProps}
                />

                <UrlSelectItemGroup
                  items={items.filter(
                    (item) => !recentItems.some((recentItem) => recentItem.id === item.id)
                  )}
                  refIndexOffset={1 + recentItems.length}
                  onClose={closeDropdownWithValue}
                  noHighlight={true}
                  {...commonItemProps}
                />
              </div>
            ) : (
              <>
                {filteredItems.length > 0 && (
                  <div className="url-select-group url-select-group-suggested">
                    <div className="url-select-label">Suggested paths:</div>
                    <UrlSelectItemGroup
                      items={filteredItems}
                      refIndexOffset={0}
                      onClose={closeDropdownWithValue}
                      {...commonItemProps}
                    />
                  </div>
                )}

                {filteredItems.length > 0 && filteredOutItems.length > 0 && (
                  <div className="url-select-separator" />
                )}

                {filteredOutItems.length > 0 && (
                  <div className="url-select-group url-select-group-other">
                    <UrlSelectItemGroup
                      items={filteredOutItems}
                      refIndexOffset={filteredItems.length}
                      onClose={closeDropdownWithValue}
                      {...commonItemProps}
                    />
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
