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

  // Helper function to scroll input into view
  const scrollInputIntoView = () => {
    if (containerRef.current && inputRef.current) {
      const wrapper = wrapperRef.current;
      const inputWrapper = inputWithSuggestionRef.current;

      if (wrapper && inputWrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const inputRect = inputWrapper.getBoundingClientRect();
        const wrapperScrollLeft = wrapper.scrollLeft;

        // Calculate if input is out of view
        const inputLeft = inputRect.left - wrapperRect.left + wrapperScrollLeft;
        const inputRight = inputLeft + inputRect.width;
        const visibleLeft = wrapperScrollLeft;
        const visibleRight = wrapperScrollLeft + wrapperRect.width;

        let newScrollLeft = wrapperScrollLeft;

        // If no badges, ensure there's consistent padding from the left
        if (badges.length === 0) {
          // Add 10px padding from the left edge to match badge behavior
          newScrollLeft = Math.max(0, inputLeft - 10);
        } else {
          // Scroll to show input if it's out of view
          if (inputRight > visibleRight) {
            newScrollLeft = inputRight - wrapperRect.width + 10; // Add some padding
          } else if (inputLeft < visibleLeft) {
            newScrollLeft = Math.max(0, inputLeft - 10); // Add some padding
          }
        }

        if (newScrollLeft !== wrapperScrollLeft) {
          wrapper.scrollTo({
            left: newScrollLeft,
            behavior: badges.length === 0 ? "auto" : "smooth",
          });
        }
      }
    }
  };

  // Helper function to scroll badge into view
  const scrollBadgeIntoView = (badgeIndex: number, centerInViewport: boolean = false) => {
    if (badgeIndex >= 0 && containerRef.current) {
      const wrapper = wrapperRef.current;
      const badgeElements = containerRef.current.querySelectorAll(".filter-badge");
      const targetBadge = badgeElements[badgeIndex] as HTMLElement;

      if (wrapper && targetBadge) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const badgeRect = targetBadge.getBoundingClientRect();
        const wrapperScrollLeft = wrapper.scrollLeft;

        const badgeLeft = badgeRect.left - wrapperRect.left + wrapperScrollLeft;
        const badgeRight = badgeLeft + badgeRect.width;
        const visibleLeft = wrapperScrollLeft;
        const visibleRight = wrapperScrollLeft + wrapperRect.width;

        let newScrollLeft = wrapperScrollLeft;

        if (centerInViewport) {
          // Center the badge in the viewport
          if (badgeLeft < visibleLeft || badgeRight > visibleRight) {
            newScrollLeft = badgeLeft - wrapperRect.width / 2 + badgeRect.width / 2;
          }
        } else {
          // Scroll left if badge is off the left edge
          if (badgeLeft < visibleLeft) {
            newScrollLeft = badgeLeft - 10; // Add some padding
          }
          // Scroll right if badge is off the right edge
          else if (badgeRight > visibleRight) {
            newScrollLeft = badgeRight - wrapperRect.width + 10; // Add some padding
          }
        }

        if (newScrollLeft !== wrapperScrollLeft) {
          wrapper.scrollTo({
            left: Math.max(0, newScrollLeft),
            behavior: "smooth",
          });
        }
      }
    }
  };

  // Helper function to extract partial filter up to cursor position
  const parsePartialFilter = (
    text: string,
    cursorPosition: number
  ):
    | { found: true; columnName: string; value: string; beforeText: string; afterText: string }
    | { found: false } => {
    // Get text up to cursor position
    const textToCursor = text.substring(0, cursorPosition);

    // Try to match a partial filter pattern at the end of the text
    // For unquoted values: column:partialvalue
    const partialMatch = textToCursor.match(/(\w+):([^\s:"]*?)$/);

    if (partialMatch && partialMatch[2]) {
      // Ensure there's some value
      const [fullMatch, columnName, partialValue] = partialMatch;
      const columnNames = ["name", "status", "method", "type", "size", "time"];

      if (columnNames.includes(columnName.toLowerCase())) {
        const remainingText = text.substring(cursorPosition);
        const beforeFilter = textToCursor.substring(0, textToCursor.length - fullMatch.length);

        return {
          found: true,
          columnName: columnName.toLowerCase(),
          value: partialValue,
          beforeText: beforeFilter,
          afterText: remainingText,
        };
      }
    }

    return { found: false };
  };

  // Calculate input width based on content using OffscreenCanvas for efficient text measurement
  useEffect(() => {
    if (inputRef.current) {
      const canvas = new OffscreenCanvas(0, 0);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      // Get the computed font from the input element
      const computedStyle = window.getComputedStyle(inputRef.current);
      ctx.font = computedStyle.font;

      // Measure based on current value + suggestion for proper width
      const textToMeasure = value + (suggestion || "");
      const textToUse = textToMeasure || (badges.length === 0 ? placeholder : "") || "W";

      const textMetrics = ctx.measureText(textToUse);
      const measuredWidth = textMetrics.width;

      // Set minimum width and add some padding for natural flow
      const calculatedWidth = Math.max(20, measuredWidth + 10);
      setInputWidth(calculatedWidth);
    }
  }, [value, placeholder, badges.length, suggestion]);

  // Focus container when navigating to badges, but avoid interfering with input focus
  useEffect(() => {
    if (
      focusedBadgeIndex >= 0 &&
      containerRef.current &&
      document.activeElement !== containerRef.current
    ) {
      containerRef.current.focus();
    }
  }, [focusedBadgeIndex]);

  // Scroll focused badge into view
  useEffect(() => {
    if (focusedBadgeIndex >= 0) {
      scrollBadgeIntoView(focusedBadgeIndex);
    }
  }, [focusedBadgeIndex]);

  // Reset scroll position when no badges are present
  useEffect(() => {
    if (badges.length === 0 && containerRef.current) {
      scrollInputIntoView();
    }
  }, [badges.length]);

  // Parse text to extract completed filters as badges
  const parseTextToBadges = (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        newBadge: null,
        remainingText: text,
        foundValidFilters: false,
      };
    }

    // Extract filters from the beginning of the text
    // Support both quoted and unquoted values: method:value or method:"quoted value"
    // No spaces allowed before or immediately after the colon
    // Empty quotes are not considered valid
    // Unquoted values cannot start with a quote character
    let newBadge: FilterBadge | null = null;
    let remainingText = trimmedText;
    let foundValidFilters = false;

    // Extract the first filter from the beginning of the text
    // Support both quoted and unquoted values: method:value or method:"quoted value"
    // No spaces allowed before or immediately after the colon
    // Empty quotes are not considered valid
    // Unquoted values cannot start with a quote character

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
      // Try to match unquoted value: column:value (until space or end)
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
        foundValidFilters = true;
        const normalizedColumnName = columnName.toLowerCase();
        const normalizedValue = filterValue.trim();

        // Create new badge since it doesn't already exist
        newBadge = {
          id: `${normalizedColumnName}-${normalizedValue}-${Date.now()}-${Math.random()}`,
          columnName: normalizedColumnName,
          value: normalizedValue,
        };

        // Remove this filter from the beginning of remaining text
        remainingText = remainingText.substring(fullMatch.length).trim();
      }
    }

    return { newBadge, remainingText, foundValidFilters };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  // Helper function to create badges from current value
  const createBadgesFromValue = () => {
    const { newBadge, remainingText, foundValidFilters } = parseTextToBadges(value);

    // Always update the input with remaining text if valid filters were found
    if (foundValidFilters) {
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

      // Remove focus from input field to prevent navigation conflicts
      if (inputRef.current) {
        inputRef.current.blur();
      }

      // Scroll to the duplicate badge
      scrollBadgeIntoView(duplicateBadgeIndex, true); // Center the duplicate badge in viewport

      // Remove highlight after animation (but keep focus)
      setTimeout(() => {
        setHighlightedBadgeId(null);
      }, 600);
    } else if (newBadge) {
      const updatedBadges = [...badges, newBadge];
      setBadges(updatedBadges);
      onBadgesChange?.(updatedBadges);

      // Scroll to ensure the input (now positioned after the new badge) is visible
      setTimeout(() => {
        scrollInputIntoView();
      }, 10);
    }

    // Return true if there were any valid filter patterns (even if duplicates)
    return foundValidFilters;
  };

  // Individual key handlers
  const handleArrowLeft = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    if (currentPosition === 0 && badges.length > 0 && focusedBadgeIndex === -1) {
      // Move from input to last badge
      e.preventDefault();
      setFocusedBadgeIndex(badges.length - 1);
      inputRef.current?.blur();
      return true;
    } else if (focusedBadgeIndex > 0) {
      // Move to previous badge
      e.preventDefault();
      setFocusedBadgeIndex(focusedBadgeIndex - 1);
      return true;
    }
    return false;
  };

  const handleArrowRight = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (focusedBadgeIndex >= 0) {
      // Move from badge to input or next badge
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
      return true;
    }

    return false;
  };

  const handleDelete = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (focusedBadgeIndex >= 0) {
      // Delete focused badge
      e.preventDefault();
      const newBadges = badges.filter((_, index) => index !== focusedBadgeIndex);
      setBadges(newBadges);
      onBadgesChange?.(newBadges);

      // Focus previous badge or input
      const newFocusIndex = newBadges.length > 1 ? focusedBadgeIndex - 1 : focusedBadgeIndex;
      const isIndexOutOfRange = newFocusIndex >= newBadges.length;
      if (isIndexOutOfRange) {
        setFocusedBadgeIndex(-1);
        inputRef.current?.focus();
        scrollInputIntoView();
      } else {
        setFocusedBadgeIndex(newFocusIndex);
      }
      return true;
    }
    return false;
  };

  const handleBackspace = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentPosition: number,
    hasSelection: boolean
  ) => {
    if (focusedBadgeIndex >= 0) {
      // Functionality the same as when pressing Delete button
      handleDelete(e);
    } else if (
      currentPosition === 0 &&
      badges.length > 0 &&
      focusedBadgeIndex === -1 &&
      !hasSelection
    ) {
      // Remove last badge when backspace at beginning of input (only if no text is selected)
      e.preventDefault();
      const newBadges = badges.slice(0, -1);
      setBadges(newBadges);
      onBadgesChange?.(newBadges);
      return true;
    }
    return false;
  };

  const handleTab = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestion) {
      // Tab with suggestion - autocomplete
      e.preventDefault();
      const newValue = value + suggestion;
      onChange(newValue);
      inputRef.current?.focus();
      // Position cursor at the end of the completed text
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newValue.length, newValue.length);
      }
      // Scroll to show the cursor position
      scrollInputIntoView();
      return true;
    } else {
      // Tab without suggestion - try to create badge
      const created = createBadgesFromValue();
      if (created) {
        e.preventDefault();
        return true;
      }
    }
    return false;
  };

  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter - create badge (always, even inside quotes)
    e.preventDefault();
    createBadgesFromValue();
    return true;
  };

  const handleSpace = (e: React.KeyboardEvent<HTMLInputElement>, currentPosition: number) => {
    // Helper function to check if cursor is inside quoted value
    const isInsideQuotes = (text: string, cursorPosition: number) => {
      let quoteCount = 0;

      for (let i = 0; i < cursorPosition; i++) {
        if (text[i] === '"') {
          quoteCount++;
        }
      }

      // If we have an odd number of quotes before cursor, we're inside quotes
      return quoteCount % 2 === 1;
    };

    // Space - create badge if there's a valid filter AND we're not inside quotes
    const insideQuotes = isInsideQuotes(value, currentPosition);

    if (!insideQuotes) {
      // If cursor is not at the end, prioritize partial filter extraction
      const isAtEnd = currentPosition === value.length;

      if (!isAtEnd) {
        // Try to extract partial filter at cursor position first
        const partialResult = parsePartialFilter(value, currentPosition);

        if (partialResult.found) {
          e.preventDefault();

          // Check if this badge already exists
          const existingBadge = badges.find(
            (badge) =>
              badge.columnName === partialResult.columnName && badge.value === partialResult.value
          );

          if (existingBadge) {
            // Highlight existing badge
            const badgeIndex = badges.findIndex((badge) => badge.id === existingBadge.id);
            setHighlightedBadgeId(existingBadge.id);
            setFocusedBadgeIndex(badgeIndex);

            if (inputRef.current) {
              inputRef.current.blur();
            }

            // Scroll to the duplicate badge
            scrollBadgeIntoView(badgeIndex, true); // Center the duplicate badge in viewport

            setTimeout(() => {
              setHighlightedBadgeId(null);
            }, 600);

            // Update input with remaining text
            onChange(partialResult.beforeText + partialResult.afterText);
          } else {
            // Create new badge from partial filter
            const newBadge: FilterBadge = {
              id: `${partialResult.columnName}-${partialResult.value}-${Date.now()}-${Math.random()}`,
              columnName: partialResult.columnName,
              value: partialResult.value,
            };

            const updatedBadges = [...badges, newBadge];
            setBadges(updatedBadges);
            onBadgesChange?.(updatedBadges);

            // Update input with remaining text
            onChange(partialResult.beforeText + partialResult.afterText);

            scrollInputIntoView();
          }
          return true; // Exit early, don't check for complete filters
        }
      }

      // If at end or no partial filter found, try to parse complete filters
      const { foundValidFilters } = parseTextToBadges(value);

      if (foundValidFilters) {
        e.preventDefault();
        createBadgesFromValue();
        return true;
      }
    }
    // If inside quotes or no valid filter, let space be typed normally
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const currentPosition = target.selectionStart || 0;
    const selectionEnd = target.selectionEnd || 0;
    const hasSelection = currentPosition !== selectionEnd;

    // Handle different key types
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
    }
  };

  const removeBadge = (badgeId: string) => {
    const newBadges = badges.filter((badge) => badge.id !== badgeId);
    setBadges(newBadges);
    onBadgesChange?.(newBadges);

    // Reset focus to input
    setFocusedBadgeIndex(-1);
    setTimeout(() => {
      inputRef.current?.focus();
      // Only scroll if there are still badges remaining
      if (newBadges.length > 0) {
        scrollInputIntoView();
      }
    }, 10);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setFocusedBadgeIndex(-1); // Reset badge focus when input gains focus
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Don't reset focusedBadgeIndex here to allow badge navigation
  };

  const handleContainerClick = () => {
    if (focusedBadgeIndex === -1) {
      inputRef.current?.focus();
    }
  };

  const handleBadgeClick = (index: number) => {
    setFocusedBadgeIndex(index);
    containerRef.current?.focus(); // Focus the container so keyboard navigation works
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
      className={`filter-input-container ${suggestion ? "filter-input-container--has-suggestion" : ""} ${className || ""}`}
      onClick={handleContainerClick}
      onKeyDown={handleContainerKeyDown}
      tabIndex={focusedBadgeIndex >= 0 ? 0 : -1}
      style={{ outline: "none" }}>
      <div className="filter-input-wrapper" ref={wrapperRef}>
        {badges.map((badge, index) => (
          <div
            key={badge.id}
            className={`filter-badge ${focusedBadgeIndex === index ? "filter-badge--focused" : ""} ${highlightedBadgeId === badge.id ? "filter-badge--highlighted" : ""}`}
            title={`${badge.columnName}:${badge.value}`}
            onClick={(e) => {
              e.stopPropagation();
              handleBadgeClick(index);
            }}
            style={{ cursor: "pointer" }}>
            <span className="filter-badge__text">
              <span className="filter-badge__name">{badge.columnName}</span>
              <span className="filter-badge__separator">:</span>
              <span className="filter-badge__value">{badge.value}</span>
            </span>
            <button
              className="filter-badge__remove"
              onClick={(e) => {
                e.stopPropagation();
                removeBadge(badge.id);
              }}
              type="button"
              aria-label="Remove filter">
              ×
            </button>
          </div>
        ))}
        <div className="filter-input-with-suggestion" ref={inputWithSuggestionRef}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={badges.length === 0 ? placeholder : ""}
            className={`filter-input ${isFocused ? "filter-input--focused" : ""}`}
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
