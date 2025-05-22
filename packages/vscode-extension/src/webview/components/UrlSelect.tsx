import React, { useEffect, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { VscodeTextfield } from "@vscode-elements/react-elements";
import { partition, differenceBy } from "lodash";
import UrlSelectItem from "./UrlSelectItem";
import UrlSelectItemGroup from "./UrlSelectItemGroup";
import "./UrlSelect.css";
import { useProject } from "../providers/ProjectProvider";
import { NavigationHistoryItem, Route } from "../../common/Project";

export type UrlSelectFocusable = HTMLDivElement | HTMLInputElement;

interface UrlSelectProps {
  onValueChange: (newValue: string) => void;
  navigationHistory: NavigationHistoryItem[];
  routeList: Route[];
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
  const [allItems, setAllItems] = React.useState<NavigationHistoryItem[]>([]);
  const [filteredItems, setFilteredItems] = React.useState<NavigationHistoryItem[]>([]);
  const [filteredOutItems, setFilteredOutItems] = React.useState<NavigationHistoryItem[]>([]);
  const [inputValue, setInputValue] = React.useState("/");
  const [dynamicSegmentNames, setDynamicSegmentNames] = React.useState<string[]>([]);
  const [currentDynamicSegment, setCurrentDynamicSegment] = React.useState<number>(0);
  const [textfieldWidth, setTextfieldWidth] = React.useState<number>(0);
  const textfieldRef = useRef<HTMLInputElement>(null);

  const itemsRef = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
  const { project, projectState } = useProject();

  const routeItems = routeList.map((route) => ({
    id: route.path,
    displayName: route.path,
    dynamic: route.dynamic ? true : false,
  }));

  const getNameFromId = (id: string) => {
    const itemForID = [...routeItems, ...navigationHistory].find(
      (item) => item.id === id || item.displayName === id
    );
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

  const closeDropdownWithValue = (id: string) => {
    const dynamicSegments = findDynamicSegments({ id, displayName: id });
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
    setInputValue(navigationHistory[0]?.displayName ?? "");
  }, [navigationHistory[0]?.id]);

  // Reset the displayed path to ensure the input is always in sync with the app
  useEffect(() => {
    if (projectState.status === "starting" || navigationHistory.length === 0) {
      setInputValue("/");
    }
  }, [projectState.status, navigationHistory[0]?.id]);

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
    const routesNotInRecent = differenceBy(
      routeItems,
      navigationHistory,
      (item: NavigationHistoryItem) => getNameFromId(item.id)
    );
    const combinedItems = [...navigationHistory, ...routesNotInRecent];
    setAllItems(combinedItems);
  }, [inputValue, navigationHistory]);

  // Update the filtered items based on the input value
  useEffect(() => {
    if (disabled) {
      setFilteredItems([]);
      return;
    }
    const inputValueLowerCase = inputValue?.toLowerCase();
    const [filtered, filteredOut] = partition(allItems, (item) =>
      item.displayName?.toLowerCase().includes(inputValueLowerCase)
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
                if (e.shiftKey && currentDynamicSegment > 0) {
                  e.preventDefault();
                  setCurrentDynamicSegment(currentDynamicSegment - 1);
                } else if (!e.shiftKey && currentDynamicSegment < dynamicSegmentNames.length - 1) {
                  e.preventDefault();
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
                  item={{ id: "/", displayName: "/" }}
                  ref={itemsRef.current[0]}
                  refIndex={0}
                  onClose={() => {
                    setInputValue("/");
                    setIsDropdownOpen(false);
                    project.navigateHome();
                  }}
                  {...commonItemProps}
                  noHighlight={true}
                />

                <UrlSelectItemGroup
                  items={navigationHistory}
                  refIndexOffset={1}
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
