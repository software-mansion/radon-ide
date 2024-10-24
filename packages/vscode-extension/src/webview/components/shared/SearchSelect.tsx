import { ReactNode, useEffect, useRef, useState } from 'react';
import './SearchSelect.css';
import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';

interface SearchSelectProps {
  className?: string
  searchPlaceholder?: string
  options: string[]
  isLoading: boolean
  onValueChange: (value: string) => void
}

export const SearchSelect = ({ className, searchPlaceholder, options, isLoading, onValueChange }: SearchSelectProps) => {
  console.log('options:', options);
  console.log('isLoading', isLoading);

  const [value, setValue] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [matches, setMatches] = useState<string[]>(options);
  const [selectedElement, setSelectedElement] = useState<number | undefined>(undefined);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();

        if (e.key === 'ArrowDown') {
          setSelectedElement((currSelectedElement) => 
            currSelectedElement === undefined ? 0 : currSelectedElement + 1);
        } else {
          setSelectedElement((currSelectedElement) => 
            currSelectedElement === undefined ? -1 : currSelectedElement - 1);
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setValue("");
    setQuery("");
    setMatches(options);
    setSelectedElement(undefined);
  }, [options]);

  useEffect(() => {
    onValueChange(value);
  }, [value]);

  const updateValue = (newValue: string, updateQuery: boolean) => {
    setValue(newValue);
    updateQuery && setQuery(newValue);
  };

  useEffect(() => {
    if (selectedElement === undefined) {
      return;
    } else if (selectedElement < 0) {
      setSelectedElement(selectedElement + matches.length);
    } else if (selectedElement >= matches.length) {
      setSelectedElement(selectedElement - matches.length);
    } else {
      const targetDiv = document.getElementById(`match-element-${selectedElement}`);
      if (targetDiv) {
        targetDiv.scrollIntoView({ behavior: 'smooth' });
      }
      updateValue(matches[selectedElement], false);
    }
  }, [selectedElement]);

  useEffect(() => {
    setSelectedElement(undefined);
    setMatches(query ? options.filter((opt) => opt.includes(query)) : options);
  }, [query]);

  const getOptionWithHighlight = (element: string): ReactNode => {
    const queryPosition = element.indexOf(query);

    if (queryPosition === -1) {
      return <span>{element}</span>;
    } else {
      const [left, right] = [queryPosition, queryPosition + query.length];
      return (
        <>
          <span>
            {element.substring(0, left)}
            <span className="match-highlighted">{element.substring(left, right)}</span>
            {element.substring(right)}
          </span>
        </>
      );
    }
  };

  return (
    <div className={className}>
      <div className="search-bar-wrapper">
        <span className="codicon codicon-search search-icon" />
        <input
          className="search-input"
          ref={inputRef}
          type="string"
          value={value}
          placeholder={ searchPlaceholder ?? "Input to search" }
          onChange={(e) => updateValue(e.target.value, true)}
        />
      </div>
        <div 
          className="matches-container"
          onMouseDown={(e) => e.preventDefault()}
        >
          { isLoading ? <div className="loading-spinner-container"><VSCodeProgressRing /></div> : (
            matches.length > 0 ? (
              matches.map((element, index) => (
                <div
                  key={`match-element-${index}`}
                  id={`match-element-${index}`}
                  className={`match-option ${
                    selectedElement === index && "selected-match"
                  }`}
                  onClick={() => setSelectedElement(index)}>
                  {getOptionWithHighlight(element)}
                </div>
              ))
            ) : (
              <div className="empty-matches">no entries found</div>
            )
          )}
        </div>
    </div>
  );
};