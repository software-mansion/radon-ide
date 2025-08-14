import { useState, useRef } from "react";
import "./FilterInput.css";

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestion?: string;
  className?: string;
}

function FilterInput({ value, onChange, placeholder, suggestion, className }: FilterInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      const newValue = value + suggestion;
      onChange(newValue);
      // Focus the input after updating value
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };
  return (
    <div className={`filter-input-container ${suggestion ? 'filter-input-container--has-suggestion' : ''} ${className || ''}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`filter-input ${isFocused ? 'filter-input--focused' : ''}`}
      />
      {suggestion && (
        <div className="filter-input-suggestion">
          <span className="filter-input-suggestion__existing">{value}</span>
          <span className="filter-input-suggestion__hint">{suggestion}</span>
        </div>
      )}
    </div>
  );
}

export default FilterInput;
