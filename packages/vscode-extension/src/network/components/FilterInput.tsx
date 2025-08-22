import { useState, useRef, useEffect, useLayoutEffect } from "react";
import "./FilterInput.css";
import { useNetworkFilter } from "../providers/NetworkFilterProvider";
import { NETWORK_LOG_COLUMNS, parseTextToBadge } from "../utils/networkLogUtils";

interface FilterInputProps {
  placeholder?: string;
}

type ScrollingOptions = {
  centerInViewport?: boolean | undefined;
  padding?: number | undefined;
  behavior?: "auto" | "smooth" | undefined;
};

const INPUT_LEFT_PADDING = 10;
const INPUT_UPDATE_TIMEOUT = 10;
const BADGE_HIGHLIGHT_TIMEOUT = 600;

function isWhitespace(str: string) {
  return str.trim() === "";
}

/**
 * Get autocomplete suggestion for partial filter text
 */
function getFilterAutocompleteSuggestion(filterText: string): string {
  // No suggestion if empty or ends with whitespace
  if (!filterText || isWhitespace(filterText.at(-1) ?? "")) {
    return "";
  }

  const trimmed = filterText.trim();
  // No suggestion if contains internal whitespace
  if (/\s/.test(trimmed)) {
    return "";
  }

  // Check if the input starts to match any column name
  const matchingColumn = NETWORK_LOG_COLUMNS.find((col) => col.startsWith(trimmed.toLowerCase()));

  // Only suggest if there's a match and it's not already complete
  if (matchingColumn && `${matchingColumn}:` !== trimmed.toLowerCase()) {
    return `${matchingColumn.substring(trimmed.length)}:`;
  }

  return "";
}

function FilterInput({ placeholder }: FilterInputProps) {
  const {
    filterInputRef,
    filterText,
    filterBadges,
    wasColumnFilterAddedToInputField,
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
  const [focusedBadgeIndex, setFocusedBadgeIndex] = useState<number | null>(null);
  const [highlightedBadgeId, setHighlightedBadgeId] = useState<string | null>(null);

  const focusFilterInput = () => {
    filterInputRef.current?.focus();
  };

  const setFilterInputCursorPosition = (position: number) => {
    filterInputRef.current?.setSelectionRange(position, position);
  };

  const scrollElementIntoView = (
    element: HTMLElement,
    options: ScrollingOptions = {},
    centerInViewport: boolean = false
  ) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const { padding = INPUT_LEFT_PADDING, behavior = "smooth" } = options;
    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperScrollLeft = wrapper.scrollLeft;
    const elementRect = element.getBoundingClientRect();

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

    if (newScrollLeft !== wrapperScrollLeft) {
      wrapper.scrollTo({
        left: Math.max(0, newScrollLeft),
        behavior,
      });
    }
  };

  const scrollInputIntoView = () => {
    if (containerRef.current && filterInputRef.current) {
      const wrapper = wrapperRef.current;
      const inputWrapper = inputWithSuggestionRef.current;

      if (!wrapper || !inputWrapper) {
        return;
      }
      // If no badges, add left padding
      const scrollingOptions: ScrollingOptions =
        filterBadges.length === 0
          ? { behavior: "auto", padding: INPUT_LEFT_PADDING }
          : { padding: INPUT_LEFT_PADDING };
      scrollElementIntoView(inputWrapper, scrollingOptions);
    }
  };

  const scrollBadgeIntoView = (badgeIndex: number, centerInViewport: boolean = false) => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container || badgeIndex < 0) {
      return;
    }

    const badgeElements = container.querySelectorAll<HTMLDivElement>(".filter-badge");
    const targetBadge = badgeElements[badgeIndex];
    if (!targetBadge) {
      return;
    }

    const scrollingOptions: ScrollingOptions = { padding: INPUT_LEFT_PADDING };
    scrollElementIntoView(targetBadge, scrollingOptions, centerInViewport);
  };

  /**
   * Creates filter badges from a text value by parsing the input string.
   *
   * When a duplicate badge is detected, it will be highlighted for 600ms and scrolled into view.
   * For new badges, the input field will be scrolled into view after a brief timeout.
   *
   * If cursorPosition is provided, the badge will be created from the text up to this position.
   *
   * @param textValue - The text input to parse into a badge
   * @param cursorPosition - Optional cursor position, which defines the end of the badge text
   * @returns `true` if a badge was successfully created or a duplicate was found and highlighted, `false` if the badge creation failed
   */
  const createNewBadgeFromValue = (textValue: string, cursorPosition?: number): boolean => {
    const cursorPositionSet = cursorPosition !== undefined;
    const badgeTextValue = cursorPositionSet ? textValue.substring(0, cursorPosition) : textValue;
    const afterBadgeTextValue = cursorPositionSet ? textValue.substring(cursorPosition) : "";

    const { badge: newBadge, remainingText } = parseTextToBadge(badgeTextValue);
    const remainingTextToInsert = remainingText + afterBadgeTextValue;

    // Don't create badge if value is empty string
    if (!newBadge) {
      return false;
    }

    // No new badge added, but return true for handlers to cancel event default behaviour
    if (newBadge.value === "") {
      handleFilterTextChange(remainingTextToInsert);
      return true;
    }

    // Set filterText upon successfully creating a badge
    if (newBadge) {
      handleFilterTextChange(remainingTextToInsert);
    }

    // Handle duplicate badge highlighting
    const newBadgeColumn = newBadge?.columnName;
    const newBadgeValue = newBadge?.value;
    const existingBadge = filterBadges.find(
      (badge) => badge.columnName === newBadgeColumn && badge.value === newBadgeValue
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
      }, BADGE_HIGHLIGHT_TIMEOUT);
      return true;
    }

    // badge is not duplicate - update badges
    const updatedBadges = [...filterBadges, newBadge];
    setFilterBadges(updatedBadges);

    // Scroll to ensure the input (now positioned after the new badge) is visible
    // timeout for useEffect to fire, hack but reliable
    setTimeout(() => {
      scrollInputIntoView();
    }, INPUT_UPDATE_TIMEOUT);

    return true;
  };

  const removeBadge = (index: number) => {
    const badgeId = filterBadges[index].id;
    const newBadges = filterBadges.filter((badge) => badge.id !== badgeId);
    setFilterBadges(newBadges);

    // Set proper focus
    if (focusedBadgeIndex === null) {
      focusFilterInput();
      scrollInputIntoView();
    } else if (newBadges.length === 0) {
      setFocusedBadgeIndex(null);
      focusFilterInput();
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
    container.querySelectorAll(".filter-badge").forEach((badge) => {
      badgesWidth += badge.clientWidth + badgeGap;
    });

    const safetyPadding = 5;
    inputOccupiedSpaceRef.current = badgesWidth + containerPaddingX + safetyPadding;
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
    const safetyPadding = 10; // Additional padding to ensure input is not too small
    const calculatedWidth = Math.max(remainingWidth, measuredWidth + safetyPadding);
    setInputWidth(calculatedWidth);
  }, [filterText, placeholder, filterBadges, suggestion]);

  // Focus container when navigating to badges, but avoid interfering with input focus
  useEffect(() => {
    if (focusedBadgeIndex !== null) {
      containerRef.current?.focus();
      scrollBadgeIntoView(focusedBadgeIndex);
    }
  }, [focusedBadgeIndex]);

  /**
   * Below useEffect is meant to work like an event listener - it triggers when a column filter is added.
   * wasColumnFilterAddedToInputField after set true is immediately set false afterwards within the NetworkFilter provider,
   * which results in the input field being focused and the cursor positioned correctly after the addColumntToInputField
   * from the provider is called
   */
  useEffect(() => {
    if (wasColumnFilterAddedToInputField) {
      focusFilterInput();
      const firstQuoteIndex = filterText.indexOf('"');
      if (firstQuoteIndex !== -1) {
        setFilterInputCursorPosition(firstQuoteIndex + 1);
      }

      // Timeout for useEffect recalculating input's width
      setTimeout(() => {
        scrollInputIntoView();
      }, INPUT_UPDATE_TIMEOUT);
    }
  }, [wasColumnFilterAddedToInputField]);

  /**
   * ArrowLeft - Navigate from input to last badge or between badges
   */
  const handleArrowLeft = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (currentPosition === 0 && filterBadges.length > 0 && focusedBadgeIndex === null) {
      // Move from input to last badge
      e.preventDefault();
      setFocusedBadgeIndex(filterBadges.length - 1);
      filterInputRef.current?.blur();
    } else if (focusedBadgeIndex !== null && focusedBadgeIndex > 0) {
      // Move to previous badge
      e.preventDefault();
      setFocusedBadgeIndex(focusedBadgeIndex - 1);
    }
  };

  /**
   * ArrowRight - Navigate from badge to input or next badge
   */
  const handleArrowRight = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (focusedBadgeIndex !== null) {
      e.preventDefault();

      if (focusedBadgeIndex === filterBadges.length - 1) {
        // Move from last badge to input
        setFocusedBadgeIndex(null);
        focusFilterInput();
        setFilterInputCursorPosition(0);
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
    if (focusedBadgeIndex !== null) {
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
    if (focusedBadgeIndex !== null) {
      // Functionality the same as when pressing Delete button
      removeBadge(focusedBadgeIndex);
    } else if (
      currentPosition === 0 &&
      filterBadges.length > 0 &&
      focusedBadgeIndex === null &&
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
      focusFilterInput();
      scrollInputIntoView();
    } else {
      // Tab without suggestion - try to create badge
      const wasCreated = createNewBadgeFromValue(filterText);
      if (wasCreated) {
        e.preventDefault();
      }
    }
  };

  /**
   * Enter - Create badge
   */
  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    createNewBadgeFromValue(filterText);
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

  /**
   * Space - Create badge if there's a valid filter and not inside quotes
   */
  const handleSpace = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (isInsideQuotes(filterText, currentPosition)) {
      // If inside quotes, let space be typed normally
      return;
    }
    const wasCreated = createNewBadgeFromValue(filterText, currentPosition);
    if (wasCreated) {
      e.preventDefault();
      setTimeout(() => {
        setFilterInputCursorPosition(0);
      }, INPUT_UPDATE_TIMEOUT);
    }
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
    createNewBadgeFromValue(filterText, currentPosition);
  };

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
    handleFilterTextChange(e.target.value);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setFocusedBadgeIndex(null);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
  };

  const handleInputContainerClick = () => {
    focusFilterInput();
  };

  const handleBadgeClick = (index: number) => {
    setFocusedBadgeIndex(index);
    containerRef.current?.focus(); // Focus the container so keyboard navigation works
    setTimeout(() => {
      // wait for useEffect to run first, then scroll to the center of view
      scrollBadgeIntoView(index, true);
    }, INPUT_UPDATE_TIMEOUT);
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Only handle keys when a badge is focused
    if (focusedBadgeIndex !== null) {
      handleKeyDown(e as React.KeyboardEvent<HTMLInputElement>);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`filter-input-container network-filter-input`}
      onClick={handleInputContainerClick}
      onKeyDown={handleContainerKeyDown}
      tabIndex={focusedBadgeIndex !== null ? 0 : -1}>
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
