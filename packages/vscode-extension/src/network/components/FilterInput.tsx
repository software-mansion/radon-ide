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
  const [isFocused, setIsFocused] = useState(false);
  const [badges, setBadges] = useState<FilterBadge[]>([]);
  const [inputWidth, setInputWidth] = useState<number>(50);

  // Calculate input width based on content
  useEffect(() => {
    if (inputRef.current) {
      // Create a hidden span to measure text width
      const span = document.createElement('span');
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.style.whiteSpace = 'pre';
      span.style.font = window.getComputedStyle(inputRef.current).font;
      span.textContent = value || placeholder || '';
      document.body.appendChild(span);
      
      const measuredWidth = span.offsetWidth;
      document.body.removeChild(span);
      
      // Set minimum width and add some padding
      setInputWidth(Math.max(50, measuredWidth + 20));
    }
  }, [value, placeholder]);

  // Parse text to extract completed filters as badges
  const parseTextToBadges = (text: string) => {
    const filterRegex = /(\w+):\s*([^:]*?)(?=\s+\w+:|$)/g;
    const newBadges: FilterBadge[] = [];
    let match;
    let remainingText = text;
    
    while ((match = filterRegex.exec(text)) !== null) {
      const [fullMatch, columnName, filterValue] = match;
      const columnNames = ['name', 'status', 'method', 'type', 'size', 'time'];
      
      if (columnNames.includes(columnName.toLowerCase()) && filterValue.trim()) {
        newBadges.push({
          id: `${columnName}-${filterValue}-${Date.now()}-${Math.random()}`,
          columnName: columnName.toLowerCase(),
          value: filterValue.trim(),
        });
        
        // Remove this filter from remaining text
        remainingText = remainingText.replace(fullMatch, '').trim();
      }
    }
    
    return { badges: newBadges, remainingText };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const currentPosition = target.selectionStart || 0;
    
    // Helper function to create badges from current value
    const createBadgesFromValue = () => {
      const { badges: newBadges } = parseTextToBadges(value);
      if (newBadges.length > 0) {
        setBadges(prev => [...prev, ...newBadges]);
        onBadgesChange?.([...badges, ...newBadges]);
        return true;
      }
      return false;
    };
    
    if (e.key === 'Tab' && suggestion) {
      // Tab with suggestion - autocomplete
      e.preventDefault();
      const newValue = value + suggestion;
      onChange(newValue);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (e.key === 'Tab' && !suggestion) {
      // Tab without suggestion - try to create badge
      const created = createBadgesFromValue();
      if (created) {
        e.preventDefault();
      }
    } else if (e.key === 'Enter') {
      // Enter - create badge
      e.preventDefault();
      createBadgesFromValue();
    } else if (e.key === ' ') {
      // Space - create badge if there's a valid filter
      const { badges: newBadges } = parseTextToBadges(value);
      if (newBadges.length > 0) {
        e.preventDefault();
        createBadgesFromValue();
      }
      // If no valid filter, let space be typed normally
    } else if (e.key === 'Backspace' && currentPosition === 0 && badges.length > 0) {
      // Remove last badge when backspace at beginning
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
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div 
      className={`filter-input-container ${suggestion ? 'filter-input-container--has-suggestion' : ''} ${className || ''}`}
      onClick={handleContainerClick}
    >
      <div className="filter-input-wrapper">
        {badges.map((badge) => (
          <div key={badge.id} className="filter-badge" title={`${badge.columnName}:${badge.value}`}>
            <span className="filter-badge__text">
              {badge.columnName}:{badge.value}
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
