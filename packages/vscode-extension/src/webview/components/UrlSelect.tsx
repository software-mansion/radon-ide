import React, { useEffect, useLayoutEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { VscodeTextfield } from "@vscode-elements/react-elements";
import { partition, differenceBy } from "lodash";
import UrlSelectItem from "./UrlSelectItem";
import UrlSelectItemGroup from "./UrlSelectItemGroup";
import "./UrlSelect.css";
import { useProject } from "../providers/ProjectProvider";
import { NavigationHistoryItem, NavigationRoute } from "../../common/Project";

export type UrlSelectFocusable = HTMLDivElement | HTMLInputElement;

interface UrlSelectProps {
  onValueChange: (newValue: string) => void;
  navigationHistory: NavigationHistoryItem[];
  routeList: NavigationRoute[];
  disabled?: boolean;
  dropdownOnly?: boolean;
}

function UrlSelect({
  onValueChange,
  navigationHistory,
  routeList,
  disabled,
  dropdownOnly,
}: UrlSelectProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [filteredItems, setFilteredItems] = React.useState<NavigationHistoryItem[]>([]);
  const [filteredOutItems, setFilteredOutItems] = React.useState<NavigationHistoryItem[]>([]);
  const [inputValue, setInputValue] = React.useState("/");
  const [dynamicSegmentNames, setDynamicSegmentNames] = React.useState<string[]>([]);
  const [currentDynamicSegment, setCurrentDynamicSegment] = React.useState<number>(0);
  const [textfieldWidth, setTextfieldWidth] = React.useState<number>(0);

  const dropdownItems: UrlSelectFocusable[] = [];

  const textfieldRef = React.useRef<HTMLInputElement>(null);
  const { project, selectedDeviceSession } = useProject();

  const routeItems = React.useMemo(
    () =>
      routeList.map((route) => ({
        id: route.path,
        displayName: route.path,
        dynamic: route.dynamic ? true : false,
      })),
    [routeList]
  );

  const getNameFromId = (id: string) => {
    const itemForID = [...navigationHistory, ...routeItems].find((item) => item.id === id);
    if (!itemForID) {
      return id;
    }
    return itemForID.displayName;
  };

  const findDynamicSegments = (item: NavigationHistoryItem) => {
    const matchingRoute = routeList.find((route) => route.path === item.id);
    if (matchingRoute && matchingRoute.dynamic) {
      return matchingRoute.dynamic.map((segment) => segment.name);
    }
    return null;
  };

  const closeDropdownWithValue = (item: NavigationHistoryItem) => {
    const dynamicSegments = findDynamicSegments(item);
    if (dynamicSegments && dynamicSegments.length > 0) {
      editDynamicPath(item, dynamicSegments);
      return;
    }
    setInputValue(item.displayName);
    onValueChange(item.id);
    setIsDropdownOpen(false);
    setDynamicSegmentNames([]);
    setCurrentDynamicSegment(0);
    setTimeout(() => textfieldRef.current?.blur(), 0);
  };

  const editDynamicPath = (item: NavigationHistoryItem, segmentNames: string[]) => {
    setInputValue(item.displayName);
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

  const focusBetweenItems = (
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
    itemList: dropdownItems,
    textfieldRef: textfieldRef as React.RefObject<HTMLInputElement>,
    onArrowPress: focusBetweenItems,
    getNameFromId,
  };

  // Compute combinedItems inline
  const combinedItems = React.useMemo(() => {
    const routesNotInHistory = differenceBy(
      routeItems,
      navigationHistory,
      (item: NavigationHistoryItem) => item.displayName
    );
    return [...navigationHistory, ...routesNotInHistory];
  }, [navigationHistory, routeItems]);

  // Reset the input on app reload
  useEffect(() => {
    if (selectedDeviceSession?.status === "starting") {
      setInputValue("/");
    }
  }, [selectedDeviceSession?.status]);

  // Refresh the input value when the navigation history changes
  useEffect(() => {
    setInputValue(navigationHistory[0]?.displayName ?? "/");
  }, [navigationHistory[0]?.id]);

  // Update the filtered items based on the input value
  useEffect(() => {
    if (disabled) {
      setFilteredItems([]);
      return;
    }
    const inputValueLowerCase = inputValue?.toLowerCase();
    const [filtered, filteredOut] = partition(combinedItems, (item) =>
      item.displayName?.toLowerCase().includes(inputValueLowerCase)
    );
    setFilteredItems(filtered);
    setFilteredOutItems(filteredOut);
  }, [inputValue, combinedItems, disabled]);

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
  useLayoutEffect(() => {
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
            value={inputValue ?? ""}
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
                if (e.shiftKey && currentDynamicSegment > 0) {
                  e.preventDefault();
                  setCurrentDynamicSegment(currentDynamicSegment - 1);
                } else if (!e.shiftKey && currentDynamicSegment < dynamicSegmentNames.length - 1) {
                  e.preventDefault();
                  setCurrentDynamicSegment(currentDynamicSegment + 1);
                }
              }
              if (e.key === "Enter") {
                closeDropdownWithValue({
                  id: textfieldRef.current?.value ?? "",
                  displayName: textfieldRef.current?.value ?? "",
                });
              }
              if (e.key === "Escape") {
                setIsDropdownOpen(false);
                setTimeout(() => textfieldRef.current?.blur(), 0);
              }
              if (e.key === "ArrowDown") {
                if (isDropdownOpen) {
                  focusBetweenItems(e, undefined, dropdownItems[0]);
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
                  item={{ id: "/", displayName: "/" }}
                  refIndex={0}
                  onConfirm={() => {
                    setIsDropdownOpen(false);
                    project.navigateHome();
                    setInputValue("/");
                  }}
                  {...commonItemProps}
                  noHighlight={true}
                />

                <UrlSelectItemGroup
                  items={navigationHistory}
                  refIndexOffset={1}
                  onConfirm={closeDropdownWithValue}
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
                      onConfirm={closeDropdownWithValue}
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
                      onConfirm={closeDropdownWithValue}
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
