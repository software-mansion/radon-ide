import { useState, useRef, useEffect } from "react";
import "./FilterInput.css";

interface FilterBadge {
  id: string;
  columnName: string;
  value: string;
}

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
  onBadgesChange?: (badges: FilterBadge[]) => void;
  placeholder?: string;
  suggestion?: string;
  className?: string;
}

type ScrollingOptions = {
  centerInViewport?: boolean | undefined;
  padding?: number | undefined;
  behavior?: "auto" | "smooth" | undefined;
};

function FilterInput({
  value,
  onChange,
  onBadgesChange,
  placeholder,
  suggestion,
  className,
}: FilterInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputWithSuggestionRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [badges, setBadges] = useState<FilterBadge[]>([]);
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
    if (containerRef.current && inputRef.current) {
      const wrapper = wrapperRef.current;
      const inputWrapper = inputWithSuggestionRef.current;

      if (wrapper && inputWrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const inputRect = inputWrapper.getBoundingClientRect();
        const wrapperScrollLeft = wrapper.scrollLeft;

        // If no badges, add left padding
        const scrollingOptions: ScrollingOptions =
          badges.length === 0 ? { behavior: "auto", padding: 10 } : { padding: 10 };
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

  const parseTextToBadges = (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        newBadge: null,
        remainingText: text,
      };
    }

    // Extract filters from the beginning of the text
    // Support both quoted and unquoted values: method:value or method:"quoted value"
    // No spaces allowed before or immediately after the colon
    // Empty quotes are not considered valid
    // Unquoted values cannot start with a quote character
    let newBadge: FilterBadge | null = null;
    let remainingText = trimmedText;

    let fullMatch = "";
    let columnName = "";
    let filterValue = "";

    // Try to match quoted value first: column:"value"
    const quotedMatch = remainingText.match(/^(\w+):"([^"]+)"/);
    if (quotedMatch) {
      fullMatch = quotedMatch[0];
      columnName = quotedMatch[1];
      filterValue = quotedMatch[2];
    } else {
      // Try to match unquoted value: column:value (until space)
      const unquotedMatch = remainingText.match(/^(\w+):([^\s:"][^\s]*?)(?=\s|$)/);
      if (unquotedMatch) {
        fullMatch = unquotedMatch[0];
        columnName = unquotedMatch[1];
        filterValue = unquotedMatch[2];
      }
    }

    if (fullMatch && columnName && filterValue) {
      const columnNames = ["name", "status", "method", "type", "size", "time"];

      if (columnNames.includes(columnName.toLowerCase()) && filterValue.trim()) {
        const normalizedColumnName = columnName.toLowerCase();
        const normalizedValue = filterValue.trim();

        newBadge = {
          id: `${normalizedColumnName}-${normalizedValue}-${Date.now()}-${Math.random()}`,
          columnName: normalizedColumnName,
          value: normalizedValue,
        };

        remainingText = remainingText.substring(fullMatch.length).trim();
      }
    }

    return { newBadge, remainingText };
  };

  // Helper function to create badges from current value
  const createBadgesFromValue = (textValue: string) => {
    const { newBadge, remainingText } = parseTextToBadges(textValue);

    if (newBadge) {
      onChange(remainingText);
    }

    // Handle duplicate badge highlighting
    const newBadgeName = newBadge?.columnName;
    const newBadgeValue = newBadge?.value;
    const existingBadge = badges.find(
      (badge) => badge.columnName === newBadgeName && badge.value === newBadgeValue
    );

    if (existingBadge) {
      // Highlight and focus the duplicate badge
      const duplicateBadge = existingBadge;
      const duplicateBadgeIndex = badges.findIndex((badge) => badge.id === duplicateBadge.id);

      setHighlightedBadgeId(duplicateBadge.id);
      setFocusedBadgeIndex(duplicateBadgeIndex);
      inputRef.current?.blur();
      scrollBadgeIntoView(duplicateBadgeIndex, true);

      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedBadgeId(null);
      }, 600);
    } else if (newBadge) {
      const updatedBadges = [...badges, newBadge];
      setBadges(updatedBadges);
      onBadgesChange?.(updatedBadges);

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
    const badgeId = badges[index].id;
    const newBadges = badges.filter((badge) => badge.id !== badgeId);
    setBadges(newBadges);
    onBadgesChange?.(newBadges);

    // Reset focus to input
    if (focusedBadgeIndex === -1) {
      inputRef.current?.focus();
      scrollInputIntoView();
    } else if (newBadges.length === 0) {
      setFocusedBadgeIndex(-1);
      inputRef.current?.focus();
    } else if (index === focusedBadgeIndex) {
      const newFocusIndex = index === badges.length - 1 ? index - 1 : index;
      setFocusedBadgeIndex(newFocusIndex);
    } else {
      const newBadgeIndex = newBadges.findIndex(
        (badge) => badge.id === badges[focusedBadgeIndex].id
      );
      setFocusedBadgeIndex(newBadgeIndex);
    }
  };

  /**
   * Calculate input width based on content using OffscreenCanvas. This approach is needed,
   * because the text needs static value in px for the layout with badges to behave
   * as expected from input field.
   */
  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    const canvas = new OffscreenCanvas(0, 0);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const computedStyle = window.getComputedStyle(inputRef.current);
    ctx.font = computedStyle.font;

    // Measure based on current value + suggestion for proper width
    const textToMeasure = value + (suggestion || "");
    const textToUse = textToMeasure || (badges.length === 0 ? placeholder : "") || "W";

    const textMetrics = ctx.measureText(textToUse);
    const measuredWidth = textMetrics.width;

    // Set minimum width and add padding for natural flow
    const calculatedWidth = Math.max(20, measuredWidth + 10);
    setInputWidth(calculatedWidth);
  }, [value, placeholder, badges.length, suggestion]);

  // Focus container when navigating to badges, but avoid interfering with input focus
  useEffect(() => {
    if (focusedBadgeIndex >= 0) {
      containerRef.current?.focus();
      scrollBadgeIntoView(focusedBadgeIndex);
    }
  }, [focusedBadgeIndex]);

  // KEY HANDLERS

  /**
   * ArrowLeft - Navigate from input to last badge or between badges
   */
  const handleArrowLeft = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (currentPosition === 0 && badges.length > 0 && focusedBadgeIndex === -1) {
      // Move from input to last badge
      e.preventDefault();
      setFocusedBadgeIndex(badges.length - 1);
      inputRef.current?.blur();
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
      if (focusedBadgeIndex === badges.length - 1) {
        // Move from last badge to input
        setFocusedBadgeIndex(-1);
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(0, 0);
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
      badges.length > 0 &&
      focusedBadgeIndex === -1 &&
      !hasSelection
    ) {
      // Remove last badge when backspace at beginning of input (only if no text is selected)
      e.preventDefault();
      removeBadge(badges.length - 1);
    }
  };

  /**
   * Tab - Autocomplete suggestion or create badge
   */
  const handleTab = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestion) {
      // Tab with suggestion - autocomplete
      e.preventDefault();
      const newValue = value + suggestion;
      onChange(newValue);
      inputRef.current?.focus();
      scrollInputIntoView();
    } else {
      // Tab without suggestion - try to create badge
      const created = createBadgesFromValue(value);
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
    createBadgesFromValue(value);
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
    const textBeforeCursor = value.substring(0, currentPosition);
    const textAfterCursor = value.substring(currentPosition);
    const newBadge = createBadgesFromValue(textBeforeCursor);
    if (newBadge) {
      if (preventDefault) {
        e.preventDefault();
      }
      onChange(textAfterCursor);
    }
  };

  /**
   * Space - Create badge if there's a valid filter and not inside quotes
   */
  const handleSpace = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (isInsideQuotes(value, currentPosition)) {
      // If inside quotes, let space be typed normally
      return;
    }
    createNewBadgeFromSubstring(e, currentPosition, true);
  };

  /**
   * Other Keys - Create badge if there's a valid filter and quotes have been just closed
   */
  const handleOtherKeys = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (countOfQuotes(value, currentPosition) === 0 || isInsideQuotes(value, currentPosition)) {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setFocusedBadgeIndex(-1);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
  };

  const handleInputContainerClick = () => {
    inputRef.current?.focus();
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
        {badges.map((badge, index) => (
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
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder={badges.length === 0 ? placeholder : ""}
            className="filter-input"
            style={{ width: `${inputWidth}px` }}
          />
          {suggestion && isFocused && (
            <div className="filter-input-suggestion">
              <span className="filter-input-suggestion__existing">{value}</span>
              <span className="filter-input-suggestion__hint">{suggestion}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilterInput;
