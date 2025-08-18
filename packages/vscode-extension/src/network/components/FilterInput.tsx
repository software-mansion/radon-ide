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

function FilterInput({ value, onChange, onBadgesChange, placeholder, suggestion, className }: FilterInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [badges, setBadges] = useState<FilterBadge[]>([]);
  const [inputWidth, setInputWidth] = useState<number>(20);
  const [focusedBadgeIndex, setFocusedBadgeIndex] = useState<number>(-1); // -1 means input is focused
  const [highlightedBadgeId, setHighlightedBadgeId] = useState<string | null>(null);

  // Calculate input width based on content to create natural flow
  useEffect(() => {
    if (inputRef.current) {
      // Create a hidden span to measure text width
      const span = document.createElement('span');
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.style.whiteSpace = 'pre';
      span.style.font = window.getComputedStyle(inputRef.current).font;
      
      // Measure based on current value + suggestion for proper width
      const textToMeasure = value + (suggestion || '');
      span.textContent = textToMeasure || (badges.length === 0 ? placeholder : '') || 'W';
      document.body.appendChild(span);
      
      const measuredWidth = span.offsetWidth;
      document.body.removeChild(span);
      
      // Set minimum width and add some padding for natural flow
      const calculatedWidth = Math.max(20, measuredWidth + 10);
      setInputWidth(calculatedWidth);
    }
  }, [value, placeholder, badges.length, suggestion]);

  // Focus container when navigating to badges, but avoid interfering with input focus
  useEffect(() => {
    if (focusedBadgeIndex >= 0 && containerRef.current && document.activeElement !== containerRef.current) {
      containerRef.current.focus();
    }
  }, [focusedBadgeIndex]);

  // Scroll focused badge into view
  useEffect(() => {
    if (focusedBadgeIndex >= 0 && containerRef.current) {
      const wrapper = containerRef.current.querySelector('.filter-input-wrapper');
      const badgeElements = containerRef.current.querySelectorAll('.filter-badge');
      const focusedBadge = badgeElements[focusedBadgeIndex] as HTMLElement;
      
      if (wrapper && focusedBadge) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const badgeRect = focusedBadge.getBoundingClientRect();
        const wrapperScrollLeft = wrapper.scrollLeft;
        
        // Calculate if badge is out of view
        const badgeLeft = badgeRect.left - wrapperRect.left + wrapperScrollLeft;
        const badgeRight = badgeLeft + badgeRect.width;
        const visibleLeft = wrapperScrollLeft;
        const visibleRight = wrapperScrollLeft + wrapperRect.width;
        
        let newScrollLeft = wrapperScrollLeft;
        
        // Scroll left if badge is off the left edge
        if (badgeLeft < visibleLeft) {
          newScrollLeft = badgeLeft - 10; // Add some padding
        }
        // Scroll right if badge is off the right edge  
        else if (badgeRight > visibleRight) {
          newScrollLeft = badgeRight - wrapperRect.width + 10; // Add some padding
        }
        
        if (newScrollLeft !== wrapperScrollLeft) {
          wrapper.scrollTo({
            left: Math.max(0, newScrollLeft),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [focusedBadgeIndex]);

  // Reset scroll position when no badges are present
  useEffect(() => {
    if (badges.length === 0 && containerRef.current) {
      // Use scrollInputIntoView for consistent behavior
      setTimeout(() => {
        scrollInputIntoView();
      }, 10);
    }
  }, [badges.length]);

  // Parse text to extract completed filters as badges
  const parseTextToBadges = (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return { badges: [], remainingText: text, foundValidFilters: false, duplicateBadgeIds: [] };
    }
    
    // Extract filters from the beginning of the text
    // Support both quoted and unquoted values: method:value or method:"quoted value"
    // No spaces allowed before or immediately after the colon
    // Empty quotes are not considered valid
    // Unquoted values cannot start with a quote character
    const newBadges: FilterBadge[] = [];
    const duplicateBadgeIds: string[] = [];
    let remainingText = trimmedText;
    let foundValidFilters = false;
    
    // Keep extracting filters from the beginning until we can't find any more
    while (remainingText.length > 0) {
      let fullMatch = '';
      let columnName = '';
      let filterValue = '';
      
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
      
      if (!fullMatch || !columnName || !filterValue) {
        // No more valid filters at the beginning, stop processing
        break;
      }
      const columnNames = ['name', 'status', 'method', 'type', 'size', 'time'];
      
      if (columnNames.includes(columnName.toLowerCase()) && filterValue.trim()) {
        foundValidFilters = true;
        const normalizedColumnName = columnName.toLowerCase();
        const normalizedValue = filterValue.trim();
        
        // Check if this badge already exists in the current badges
        const existingBadge = badges.find(badge => 
          badge.columnName === normalizedColumnName && 
          badge.value === normalizedValue
        );
        
        if (existingBadge) {
          // Track duplicate badge ID for highlighting
          duplicateBadgeIds.push(existingBadge.id);
        } else {
          // Only add if the badge doesn't already exist
          newBadges.push({
            id: `${normalizedColumnName}-${normalizedValue}-${Date.now()}-${Math.random()}`,
            columnName: normalizedColumnName,
            value: normalizedValue,
          });
        }
        
        // Remove this filter from the beginning of remaining text
        remainingText = remainingText.substring(fullMatch.length).trim();
      } else {
        // Invalid column name or empty value, stop processing
        break;
      }
    }
    
    return { badges: newBadges, remainingText, foundValidFilters, duplicateBadgeIds };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  // Helper function to scroll input into view
  const scrollInputIntoView = () => {
    if (containerRef.current && inputRef.current) {
      const wrapper = containerRef.current.querySelector('.filter-input-wrapper');
      const inputWrapper = containerRef.current.querySelector('.filter-input-with-suggestion');
      
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
            behavior: badges.length === 0 ? 'auto' : 'smooth'
          });
        }
      }
    }
  };

  // Helper function to extract partial filter up to cursor position
  const parsePartialFilter = (text: string, cursorPosition: number): 
    | { found: true; columnName: string; value: string; beforeText: string; afterText: string }
    | { found: false } => {
    // Get text up to cursor position
    const textToCursor = text.substring(0, cursorPosition);
    
    // Try to match a partial filter pattern at the end of the text
    // For unquoted values: column:partialvalue
    const partialMatch = textToCursor.match(/(\w+):([^\s:"]*?)$/);
    
    if (partialMatch && partialMatch[2]) { // Ensure there's some value
      const [fullMatch, columnName, partialValue] = partialMatch;
      const columnNames = ['name', 'status', 'method', 'type', 'size', 'time'];
      
      if (columnNames.includes(columnName.toLowerCase())) {
        const remainingText = text.substring(cursorPosition);
        const beforeFilter = textToCursor.substring(0, textToCursor.length - fullMatch.length);
        
        return {
          found: true,
          columnName: columnName.toLowerCase(),
          value: partialValue,
          beforeText: beforeFilter,
          afterText: remainingText
        };
      }
    }
    
    return { found: false };
  };

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const currentPosition = target.selectionStart || 0;
    const selectionEnd = target.selectionEnd || 0;
    const hasSelection = currentPosition !== selectionEnd;
    
    // Helper function to create badges from current value
    const createBadgesFromValue = () => {
      const { badges: newBadges, remainingText, foundValidFilters, duplicateBadgeIds } = parseTextToBadges(value);
      
      // Always update the input with remaining text if valid filters were found
      if (foundValidFilters) {
        onChange(remainingText);
      }
      
      // Handle duplicate badge highlighting
      if (duplicateBadgeIds.length > 0) {
        // Highlight and focus the first duplicate badge
        const duplicateBadgeId = duplicateBadgeIds[0];
        const badgeIndex = badges.findIndex(badge => badge.id === duplicateBadgeId);
        
        setHighlightedBadgeId(duplicateBadgeId);
        setFocusedBadgeIndex(badgeIndex);
        
        // Remove focus from input field to prevent navigation conflicts
        if (inputRef.current) {
          inputRef.current.blur();
        }
        
        // Scroll to the duplicate badge
        setTimeout(() => {
          if (badgeIndex >= 0 && containerRef.current) {
            const wrapper = containerRef.current.querySelector('.filter-input-wrapper');
            const badgeElements = containerRef.current.querySelectorAll('.filter-badge');
            const duplicateBadge = badgeElements[badgeIndex] as HTMLElement;
            
            if (wrapper && duplicateBadge) {
              const wrapperRect = wrapper.getBoundingClientRect();
              const badgeRect = duplicateBadge.getBoundingClientRect();
              const wrapperScrollLeft = wrapper.scrollLeft;
              
              const badgeLeft = badgeRect.left - wrapperRect.left + wrapperScrollLeft;
              const badgeRight = badgeLeft + badgeRect.width;
              const visibleLeft = wrapperScrollLeft;
              const visibleRight = wrapperScrollLeft + wrapperRect.width;
              
              let newScrollLeft = wrapperScrollLeft;
              
              // Center the badge in the viewport
              if (badgeLeft < visibleLeft || badgeRight > visibleRight) {
                newScrollLeft = badgeLeft - (wrapperRect.width / 2) + (badgeRect.width / 2);
              }
              
              wrapper.scrollTo({
                left: Math.max(0, newScrollLeft),
                behavior: 'smooth'
              });
            }
          }
        }, 10);
        
        // Remove highlight after animation (but keep focus)
        setTimeout(() => {
          setHighlightedBadgeId(null);
        }, 600);
      }
      
      // Only update badges if there are actually new badges to add
      if (newBadges.length > 0) {
        const updatedBadges = [...badges, ...newBadges];
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
    
    // Arrow key navigation between badges and input
    if (e.key === 'ArrowLeft' && currentPosition === 0 && badges.length > 0 && focusedBadgeIndex === -1) {
      // Move from input to last badge
      e.preventDefault();
      setFocusedBadgeIndex(badges.length - 1);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowLeft' && focusedBadgeIndex > 0) {
      // Move to previous badge
      e.preventDefault();
      setFocusedBadgeIndex(focusedBadgeIndex - 1);
    } else if (e.key === 'ArrowRight' && focusedBadgeIndex >= 0) {
      // Move from badge to input or next badge
      e.preventDefault();
      if (focusedBadgeIndex === badges.length - 1) {
        // Move from last badge to input
        setFocusedBadgeIndex(-1);
        setTimeout(() => {
          inputRef.current?.focus();
          if (inputRef.current) {
            inputRef.current.setSelectionRange(0, 0);
          }
          scrollInputIntoView();
        }, 10);
      } else {
        // Move to next badge
        setFocusedBadgeIndex(focusedBadgeIndex + 1);
      }
    } else if (e.key === 'Delete' && focusedBadgeIndex >= 0) {
      // Delete focused badge
      e.preventDefault();
      const newBadges = badges.filter((_, index) => index !== focusedBadgeIndex);
      setBadges(newBadges);
      onBadgesChange?.(newBadges);
      
      // Always return to input after deletion
      setFocusedBadgeIndex(-1);
      setTimeout(() => {
        inputRef.current?.focus();
        // Only scroll if there are still badges remaining
        if (newBadges.length > 0) {
          scrollInputIntoView();
        }
      }, 10);
    } else if (e.key === 'Backspace' && focusedBadgeIndex >= 0) {
      // Delete focused badge with backspace
      e.preventDefault();
      const newBadges = badges.filter((_, index) => index !== focusedBadgeIndex);
      setBadges(newBadges);
      onBadgesChange?.(newBadges);
      
      // Focus previous badge or input
      const newFocusIndex = focusedBadgeIndex - 1;
      if (newFocusIndex < 0) {
        setFocusedBadgeIndex(-1);
        setTimeout(() => {
          inputRef.current?.focus();
          // Only scroll if there are still badges remaining
          if (newBadges.length > 0) {
            scrollInputIntoView();
          }
        }, 10);
      } else {
        setFocusedBadgeIndex(newFocusIndex);
      }
    } else if (e.key === 'Tab' && suggestion) {
      // Tab with suggestion - autocomplete
      e.preventDefault();
      const newValue = value + suggestion;
      onChange(newValue);
      setTimeout(() => {
        inputRef.current?.focus();
        // Position cursor at the end of the completed text
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newValue.length, newValue.length);
        }
        // Scroll to show the cursor position
        scrollInputIntoView();
      }, 10);
    } else if (e.key === 'Tab' && !suggestion) {
      // Tab without suggestion - try to create badge
      const created = createBadgesFromValue();
      if (created) {
        e.preventDefault();
      }
    } else if (e.key === 'Enter') {
      // Enter - create badge (always, even inside quotes)
      e.preventDefault();
      createBadgesFromValue();
    } else if (e.key === ' ') {
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
            const existingBadge = badges.find(badge => 
              badge.columnName === partialResult.columnName && 
              badge.value === partialResult.value
            );
            
            if (existingBadge) {
              // Highlight existing badge
              const badgeIndex = badges.findIndex(badge => badge.id === existingBadge.id);
              setHighlightedBadgeId(existingBadge.id);
              setFocusedBadgeIndex(badgeIndex);
              
              if (inputRef.current) {
                inputRef.current.blur();
              }
              
              // Scroll to the duplicate badge
              setTimeout(() => {
                if (badgeIndex >= 0 && containerRef.current) {
                  const wrapper = containerRef.current.querySelector('.filter-input-wrapper');
                  const badgeElements = containerRef.current.querySelectorAll('.filter-badge');
                  const duplicateBadge = badgeElements[badgeIndex] as HTMLElement;
                  
                  if (wrapper && duplicateBadge) {
                    const wrapperRect = wrapper.getBoundingClientRect();
                    const badgeRect = duplicateBadge.getBoundingClientRect();
                    const wrapperScrollLeft = wrapper.scrollLeft;
                    
                    const badgeLeft = badgeRect.left - wrapperRect.left + wrapperScrollLeft;
                    const badgeRight = badgeLeft + badgeRect.width;
                    const visibleLeft = wrapperScrollLeft;
                    const visibleRight = wrapperScrollLeft + wrapperRect.width;
                    
                    let newScrollLeft = wrapperScrollLeft;
                    
                    if (badgeLeft < visibleLeft || badgeRight > visibleRight) {
                      newScrollLeft = badgeLeft - (wrapperRect.width / 2) + (badgeRect.width / 2);
                    }
                    
                    wrapper.scrollTo({
                      left: Math.max(0, newScrollLeft),
                      behavior: 'smooth'
                    });
                  }
                }
              }, 10);
              
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
              
              setTimeout(() => {
                scrollInputIntoView();
              }, 10);
            }
            return; // Exit early, don't check for complete filters
          }
        }
        
        // If at end or no partial filter found, try to parse complete filters
        const { foundValidFilters } = parseTextToBadges(value);
        
        if (foundValidFilters) {
          e.preventDefault();
          createBadgesFromValue();
        }
      }
      // If inside quotes or no valid filter, let space be typed normally
    } else if (e.key === 'Backspace' && currentPosition === 0 && badges.length > 0 && focusedBadgeIndex === -1 && !hasSelection) {
      // Remove last badge when backspace at beginning of input (only if no text is selected)
      e.preventDefault();
      const newBadges = badges.slice(0, -1);
      setBadges(newBadges);
      onBadgesChange?.(newBadges);
    }
  };

  const removeBadge = (badgeId: string) => {
    const newBadges = badges.filter(badge => badge.id !== badgeId);
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
      className={`filter-input-container ${suggestion ? 'filter-input-container--has-suggestion' : ''} ${className || ''}`}
      onClick={handleContainerClick}
      onKeyDown={handleContainerKeyDown}
      tabIndex={focusedBadgeIndex >= 0 ? 0 : -1}
      style={{ outline: 'none' }}
    >
      <div className="filter-input-wrapper">
        {badges.map((badge, index) => (
          <div 
            key={badge.id} 
            className={`filter-badge ${focusedBadgeIndex === index ? 'filter-badge--focused' : ''} ${highlightedBadgeId === badge.id ? 'filter-badge--highlighted' : ''}`} 
            title={`${badge.columnName}:${badge.value}`}
            onClick={(e) => {
              e.stopPropagation();
              handleBadgeClick(index);
            }}
            style={{ cursor: 'pointer' }}
          >
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
              aria-label="Remove filter"
            >
              ×
            </button>
          </div>
        ))}
        <div className="filter-input-with-suggestion">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={badges.length === 0 ? placeholder : ""}
            className={`filter-input ${isFocused ? 'filter-input--focused' : ''}`}
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
