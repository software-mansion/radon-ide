import { useState, useRef, useEffect, useLayoutEffect } from "react";
import "./FilterInput.css";
import { useNetworkFilter } from "../providers/NetworkFilterProvider";
import { NETWORK_LOG_COLUMNS, parseTextToBadge } from "../utils/networkLogFormatters";

interface FilterInputProps {
  placeholder?: string;
  className?: string;
}

type ScrollingOptions = {
  centerInViewport?: boolean | undefined;
  padding?: number | undefined;
  behavior?: "auto" | "smooth" | undefined;
};

/**
 * Get autocomplete suggestion for partial filter text
 */
function getFilterAutocompleteSuggestion(filterText: string): string {
  // No suggestion if empty or ends with whitespace
  if (!filterText || filterText !== filterText.trimEnd()) {
    return "";
  }
  const trimmed = filterText.trim();
  // No suggestion if contains internal whitespace (spaces mean it's not a partial column name)
  if (/\s/.test(trimmed)) {
    return "";
  }

  // Check if the input starts to match any column name
  const columnNames = NETWORK_LOG_COLUMNS.map((col) => col.toLowerCase());
  const matchingColumn = columnNames.find((col) => col.startsWith(trimmed.toLowerCase()));

  // Only suggest if there's a match and it's not already complete
  if (matchingColumn && matchingColumn !== trimmed.toLowerCase()) {
    return matchingColumn.substring(trimmed.length) + ":";
  }

  return "";
}

function FilterInput({ placeholder, className }: FilterInputProps) {
  const {
    filterInputRef,
    filterText,
    filterBadges,
    wasColumnFilterAdded,
    setFilterBadges,
    setFilterText,
  } = useNetworkFilter();
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputWithSuggestionRef = useRef<HTMLDivElement>(null);
  const inputOccupiedSpaceRef = useRef<number>(0);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [inputWidth, setInputWidth] = useState<number>(20);
  const [focusedBadgeIndex, setFocusedBadgeIndex] = useState<number>(-1); // -1 means input is focused
  const [highlightedBadgeId, setHighlightedBadgeId] = useState<string | null>(null);

  // Common scrolling logic
  const scrollElementIntoView = (
    elementRect: DOMRect,
    wrapperRect: DOMRect,
    wrapperScrollLeft: number,
    options: ScrollingOptions = {},
    centerInViewport: boolean = false
  ) => {
    const { padding = 10, behavior = "smooth" } = options;

    const elementLeft = elementRect.left - wrapperRect.left + wrapperScrollLeft;
    const elementRight = elementLeft + elementRect.width;
    const visibleLeft = wrapperScrollLeft;
    const visibleRight = wrapperScrollLeft + wrapperRect.width;

    let newScrollLeft = wrapperScrollLeft;

    if (centerInViewport) {
      // Center the element in the viewport
      if (elementLeft < visibleLeft || elementRight > visibleRight) {
        newScrollLeft = elementLeft - wrapperRect.width / 2 + elementRect.width / 2;
      }
    } else {
      // Scroll left if element is off the left edge
      if (elementLeft < visibleLeft) {
        newScrollLeft = elementLeft - padding;
      }
      // Scroll right if element is off the right edge
      else if (elementRight > visibleRight) {
        newScrollLeft = elementRight - wrapperRect.width + padding;
      }
    }

    if (newScrollLeft !== wrapperScrollLeft && wrapperRef.current) {
      wrapperRef.current.scrollTo({
        left: Math.max(0, newScrollLeft),
        behavior,
      });
    }
  };

  const scrollInputIntoView = () => {
    if (containerRef.current && filterInputRef.current) {
      const wrapper = wrapperRef.current;
      const inputWrapper = inputWithSuggestionRef.current;

      if (wrapper && inputWrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const inputRect = inputWrapper.getBoundingClientRect();
        const wrapperScrollLeft = wrapper.scrollLeft;

        // If no badges, add left padding
        const scrollingOptions: ScrollingOptions =
          filterBadges.length === 0 ? { behavior: "auto", padding: 10 } : { padding: 10 };
        scrollElementIntoView(inputRect, wrapperRect, wrapperScrollLeft, scrollingOptions);
      }
    }
  };

  const scrollBadgeIntoView = (badgeIndex: number, centerInViewport: boolean = false) => {
    if (badgeIndex >= 0 && containerRef.current) {
      const wrapper = wrapperRef.current;
      const badgeElements = containerRef.current.querySelectorAll(".filter-badge");
      const targetBadge = badgeElements[badgeIndex] as HTMLElement;

      if (wrapper && targetBadge) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const badgeRect = targetBadge.getBoundingClientRect();
        const wrapperScrollLeft = wrapper.scrollLeft;
        const scrollingOptions: ScrollingOptions = { padding: 10 };

        scrollElementIntoView(
          badgeRect,
          wrapperRect,
          wrapperScrollLeft,
          scrollingOptions,
          centerInViewport
        );
      }
    }
  };

  // Helper function to create badges from current value
  const createBadgesFromValue = (textValue: string) => {
    const { newBadge, remainingText } = parseTextToBadge(textValue);

    if (newBadge) {
      handleFilterTextChange(remainingText);
    }

    // Don't create badge if value is empty string
    if (!newBadge || newBadge.value === "") {
      return;
    }

    // Handle duplicate badge highlighting
    const newBadgeName = newBadge?.columnName;
    const newBadgeValue = newBadge?.value;
    const existingBadge = filterBadges.find(
      (badge) => badge.columnName === newBadgeName && badge.value === newBadgeValue
    );

    if (existingBadge) {
      // Highlight and focus the duplicate badge
      const duplicateBadge = existingBadge;
      const duplicateBadgeIndex = filterBadges.findIndex((badge) => badge.id === duplicateBadge.id);

      setHighlightedBadgeId(duplicateBadge.id);
      setFocusedBadgeIndex(duplicateBadgeIndex);
      filterInputRef.current?.blur();
      scrollBadgeIntoView(duplicateBadgeIndex, true);

      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedBadgeId(null);
      }, 600);
    } else if (newBadge) {
      const updatedBadges = [...filterBadges, newBadge];
      setFilterBadges(updatedBadges);

      // Scroll to ensure the input (now positioned after the new badge) is visible
      // 10 ms timeout for useEffect to fire
      setTimeout(() => {
        scrollInputIntoView();
      }, 10);
    }

    // Return true if there were any valid filter patterns (even if duplicates)
    return !!newBadge;
  };

  const removeBadge = (index: number) => {
    const badgeId = filterBadges[index].id;
    const newBadges = filterBadges.filter((badge) => badge.id !== badgeId);
    setFilterBadges(newBadges);

    // Reset focus to input
    if (focusedBadgeIndex === -1) {
      filterInputRef.current?.focus();
      scrollInputIntoView();
    } else if (newBadges.length === 0) {
      setFocusedBadgeIndex(-1);
      filterInputRef.current?.focus();
    } else if (index === focusedBadgeIndex) {
      const newFocusIndex = index === filterBadges.length - 1 ? index - 1 : index;
      setFocusedBadgeIndex(newFocusIndex);
    } else {
      const newBadgeIndex = newBadges.findIndex(
        (badge) => badge.id === filterBadges[focusedBadgeIndex].id
      );
      setFocusedBadgeIndex(newBadgeIndex);
    }
  };

  // Measuring the width taken in the inputContainer
  // used in reliable input field resizing. More below.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) {
      return;
    }

    const wrapperStyle = window.getComputedStyle(wrapper);
    const badgeGap = parseInt(wrapperStyle.getPropertyValue("gap"));
    const containerPaddingX =
      parseInt(wrapperStyle.getPropertyValue("padding-left")) +
      parseInt(wrapperStyle.getPropertyValue("padding-right"));

    let badgesWidth = 0;
    console.log(container.querySelectorAll(".filter-badge"));
    container.querySelectorAll(".filter-badge").forEach((badge) => {
      badgesWidth += badge.clientWidth + badgeGap;
    });

    inputOccupiedSpaceRef.current = badgesWidth + containerPaddingX;
  }, [filterBadges]);

  /**
   * Calculate input width based on content using OffscreenCanvas. This approach is needed,
   * because the text needs static value in px for the layout with badges to behave
   * as expected from input field.
   *
   * The need for use of occupiedSpaceRef arises from the fact, that we wish for the input
   * to take the remaining space of the component for its expected behaviour,
   * instead of it being very small and inaccessible.
   */
  useEffect(() => {
    const filterInput = filterInputRef.current;
    const container = containerRef.current;
    if (!filterInput || !container) {
      return;
    }

    const canvas = new OffscreenCanvas(0, 0);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const computedStyle = window.getComputedStyle(filterInput);
    ctx.font = computedStyle.font;

    // Measure based on current value + suggestion for proper width
    const textToMeasure = filterText + (suggestion || "");
    const textToUse = textToMeasure || (filterBadges.length === 0 ? placeholder : "") || "W";

    const textMetrics = ctx.measureText(textToUse);
    const measuredWidth = textMetrics.width;

    const remainingWidth = container.clientWidth - inputOccupiedSpaceRef.current;
    // Set minimum width and add padding for natural flow
    const calculatedWidth = Math.max(remainingWidth, measuredWidth + 10);
    setInputWidth(calculatedWidth);
  }, [filterText, placeholder, filterBadges, suggestion]);

  // Focus container when navigating to badges, but avoid interfering with input focus
  useEffect(() => {
    if (focusedBadgeIndex >= 0) {
      containerRef.current?.focus();
      scrollBadgeIntoView(focusedBadgeIndex);
    }
  }, [focusedBadgeIndex]);

  useEffect(() => {
    if (wasColumnFilterAdded) {
      filterInputRef.current?.focus();
      const firstQuoteIndex = filterText.indexOf('"');
      if (firstQuoteIndex !== -1) {
        filterInputRef.current?.setSelectionRange(firstQuoteIndex + 1, firstQuoteIndex + 1);
      }

      // Timeout for useEffect recalculating input's width
      setTimeout(() => {
        scrollInputIntoView();
      }, 10);
    }
  }, [wasColumnFilterAdded]);

  // KEY HANDLERS

  /**
   * ArrowLeft - Navigate from input to last badge or between badges
   */
  const handleArrowLeft = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (currentPosition === 0 && filterBadges.length > 0 && focusedBadgeIndex === -1) {
      // Move from input to last badge
      e.preventDefault();
      setFocusedBadgeIndex(filterBadges.length - 1);
      filterInputRef.current?.blur();
    } else if (focusedBadgeIndex > 0) {
      // Move to previous badge
      e.preventDefault();
      setFocusedBadgeIndex(focusedBadgeIndex - 1);
    }
  };

  /**
   * ArrowRight - Navigate from badge to input or next badge
   */
  const handleArrowRight = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (focusedBadgeIndex >= 0) {
      e.preventDefault();
      if (focusedBadgeIndex === filterBadges.length - 1) {
        // Move from last badge to input
        setFocusedBadgeIndex(-1);
        filterInputRef.current?.focus();
        filterInputRef.current?.setSelectionRange(0, 0);
      } else {
        // Move to next badge
        setFocusedBadgeIndex(focusedBadgeIndex + 1);
      }
    }
  };

  /**
   * Delete - Remove focused badge
   */
  const handleDelete = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (focusedBadgeIndex >= 0) {
      e.preventDefault();
      removeBadge(focusedBadgeIndex);
    }
  };

  /**
   * Backspace - Remove focused badge or last badge when at beginning of input
   */
  const handleBackspace = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentPosition: number,
    hasSelection: boolean
  ) => {
    if (focusedBadgeIndex >= 0) {
      // Functionality the same as when pressing Delete button
      removeBadge(focusedBadgeIndex);
    } else if (
      currentPosition === 0 &&
      filterBadges.length > 0 &&
      focusedBadgeIndex === -1 &&
      !hasSelection
    ) {
      // Remove last badge when backspace at beginning of input (only if no text is selected)
      e.preventDefault();
      removeBadge(filterBadges.length - 1);
    }
  };

  /**
   * Tab - Autocomplete suggestion or create badge
   */
  const handleTab = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestion) {
      // Tab with suggestion - autocomplete
      e.preventDefault();
      const newValue = filterText + suggestion;
      handleFilterTextChange(newValue);
      filterInputRef.current?.focus();
      scrollInputIntoView();
    } else {
      // Tab without suggestion - try to create badge
      const created = createBadgesFromValue(filterText);
      if (created) {
        e.preventDefault();
      }
    }
  };

  /**
   * Enter - Create badge (always, even inside quotes)
   */
  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    createBadgesFromValue(filterText);
  };

  const countOfQuotes = (text: string, cursorPosition: number) => {
    let quoteCount = 0;
    for (let i = 0; i < cursorPosition; i++) {
      if (text[i] === '"') {
        quoteCount++;
      }
    }
    return quoteCount;
  };

  const isInsideQuotes = (text: string, cursorPosition: number) => {
    return countOfQuotes(text, cursorPosition) % 2 === 1;
  };

  const createNewBadgeFromSubstring = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentPosition: number,
    preventDefault?: boolean
  ) => {
    const textBeforeCursor = filterText.substring(0, currentPosition);
    const textAfterCursor = filterText.substring(currentPosition);
    const newBadge = createBadgesFromValue(textBeforeCursor);
    if (newBadge) {
      if (preventDefault) {
        e.preventDefault();
      }
      handleFilterTextChange(textAfterCursor);
    }
  };

  /**
   * Space - Create badge if there's a valid filter and not inside quotes
   */
  const handleSpace = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (isInsideQuotes(filterText, currentPosition)) {
      // If inside quotes, let space be typed normally
      return;
    }
    createNewBadgeFromSubstring(e, currentPosition, true);
  };

  /**
   * Other Keys - Create badge if there's a valid filter and quotes have been just closed
   */
  const handleOtherKeys = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (
      countOfQuotes(filterText, currentPosition) === 0 ||
      isInsideQuotes(filterText, currentPosition)
    ) {
      return;
    }
    createNewBadgeFromSubstring(e, currentPosition, false);
  };

  // EVENT HANDLERS

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const currentPosition = target.selectionStart || 0;
    const selectionEnd = target.selectionEnd || 0;
    const hasSelection = currentPosition !== selectionEnd;

    if (e.key === "ArrowLeft") {
      handleArrowLeft(e, currentPosition);
    } else if (e.key === "ArrowRight") {
      handleArrowRight(e);
    } else if (e.key === "Delete") {
      handleDelete(e);
    } else if (e.key === "Backspace") {
      handleBackspace(e, currentPosition, hasSelection);
    } else if (e.key === "Tab") {
      handleTab(e);
    } else if (e.key === "Enter") {
      handleEnter(e);
    } else if (e.key === " ") {
      handleSpace(e, currentPosition);
    } else {
      handleOtherKeys(e, currentPosition);
    }
  };

  const handleFilterTextChange = (value: string) => {
    setFilterText(value);

    // Update autocomplete suggestion
    const newSuggestion = getFilterAutocompleteSuggestion(value);
    setSuggestion(newSuggestion);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    handleFilterTextChange(newValue);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setFocusedBadgeIndex(-1);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
  };

  const handleInputContainerClick = () => {
    filterInputRef.current?.focus();
  };

  const handleBadgeClick = (index: number) => {
    setFocusedBadgeIndex(index);
    containerRef.current?.focus(); // Focus the container so keyboard navigation works
    setTimeout(() => {
      // wait for useEffect to run first, then scroll to the center of view
      scrollBadgeIntoView(index, true);
    }, 10);
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Only handle keys when a badge is focused
    if (focusedBadgeIndex >= 0) {
      handleKeyDown(e as React.KeyboardEvent<HTMLInputElement>);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`filter-input-container ${className || ""}`}
      onClick={handleInputContainerClick}
      onKeyDown={handleContainerKeyDown}
      tabIndex={focusedBadgeIndex >= 0 ? 0 : -1}>
      <div className="filter-input-wrapper" ref={wrapperRef}>
        {filterBadges.map((badge, index) => (
          <div
            key={badge.id}
            className={`filter-badge ${focusedBadgeIndex === index ? "filter-badge--focused" : ""} ${highlightedBadgeId === badge.id ? "filter-badge--highlighted" : ""}`}
            title={`${badge.columnName}:${badge.value}`}
            onClick={(e) => {
              e.stopPropagation();
              handleBadgeClick(index);
            }}>
            <span className="filter-badge__text">
              <span className="filter-badge__name">{badge.columnName}</span>
              <span className="filter-badge__separator">:</span>
              <span className="filter-badge__value">{badge.value}</span>
            </span>
            <button
              className="filter-badge__remove"
              onClick={(e) => {
                e.stopPropagation();
                removeBadge(index);
              }}
              type="button"
              aria-label="Remove filter">
              <span className="codicon codicon-close" />
            </button>
          </div>
        ))}
        <div className="filter-input-with-suggestion" ref={inputWithSuggestionRef}>
          <input
            ref={filterInputRef}
            type="text"
            value={filterText}
            onChange={handleChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder={filterBadges.length === 0 ? placeholder : ""}
            className="filter-input"
            style={{ width: `${inputWidth}px` }}
          />
          {suggestion && isFocused && (
            <div className="filter-input-suggestion">
              <span className="filter-input-suggestion__existing">{filterText}</span>
              <span className="filter-input-suggestion__hint">{suggestion}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilterInput;
