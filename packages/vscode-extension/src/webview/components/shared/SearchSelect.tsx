import { ReactNode, useEffect, useRef, useState } from "react";
import "./SearchSelect.css";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import Label from "./Label";

interface SearchSelectProps {
  className?: string;
  searchPlaceholder?: string;
  optionsLabel?: string;
  options: string[];
  isLoading: boolean;
  onValueChange: (value: string) => void;
}

export const SearchSelect = ({
  className,
  searchPlaceholder,
  optionsLabel,
  options,
  isLoading,
  onValueChange,
}: SearchSelectProps) => {
  const [value, setValue] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [matches, setMatches] = useState<string[]>(options);
  const [selectedElement, setSelectedElement] = useState<number | undefined>(undefined);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();

        if (e.key === "ArrowDown") {
          setSelectedElement((currSelectedElement) =>
            currSelectedElement === undefined ? 0 : currSelectedElement + 1
          );
        } else {
          setSelectedElement((currSelectedElement) =>
            currSelectedElement === undefined ? -1 : currSelectedElement - 1
          );
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
        targetDiv.scrollIntoView({ behavior: "smooth" });
      }
      updateValue(matches[selectedElement], false);
    }
  }, [selectedElement]);

  useEffect(() => {
    setSelectedElement(undefined);
    setMatches(query ? options.filter((opt) => findMatch(opt, query) !== null) : options);
  }, [query]);

  // Performs greedy left-to-right pattern matching with holes in text.
  // Returns null if match not found, otherwise returns an array of segments of indices matching the pattern.
  const findMatch = (text: string, pattern: string): [number, number][] | null => {
    if (!pattern.length) {
      return [];
    }

    let patternPosition = 0;
    const matchedRanges: [number, number][] = [];

    Array.from(text).forEach((c, index) => {
      if (patternPosition < pattern.length && c === pattern[patternPosition]) {
        if (
          matchedRanges.length !== 0 &&
          matchedRanges[matchedRanges.length - 1][1] === index - 1
        ) {
          matchedRanges[matchedRanges.length - 1][1] += 1;
        } else {
          matchedRanges.push([index, index]);
        }
        patternPosition++;
      }
    });

    return patternPosition === pattern.length ? matchedRanges : null;
  };

  const updateValue = (newValue: string, updateQuery: boolean) => {
    setValue(newValue);
    updateQuery && setQuery(newValue);
  };

  const getOptionWithHighlight = (element: string): ReactNode => {
    const matchedRanges = findMatch(element, query);

    if (matchedRanges === null || matchedRanges.length === 0) {
      return <span>{element}</span>;
    } else {
      const spanElements = [];

      if (matchedRanges[0][0] > 0) {
        spanElements.push(<span>{element.substring(0, matchedRanges[0][0])}</span>);
      }

      matchedRanges.forEach(([from, to], index) => {
        spanElements.push(
          <span className="match-highlighted">{element.substring(from, to + 1)}</span>
        );
        if (to + 1 < element.length) {
          const nextFrom =
            index === matchedRanges.length - 1 ? element.length : matchedRanges[index + 1][0];
          spanElements.push(<span>{element.substring(to + 1, nextFrom)}</span>);
        }
      });

      return <>{spanElements}</>;
    }
  };

  return (
    <div className={className}>
      <div className="search-bar-wrapper">
        <input
          className="search-input"
          ref={inputRef}
          type="string"
          value={value}
          placeholder={searchPlaceholder ?? "Input to search"}
          onChange={(e) => updateValue(e.target.value, true)}
        />
      </div>
      { optionsLabel && <Label style={{ marginLeft: "2px" }}>{optionsLabel}</Label> }
      <div className="matches-container" onMouseDown={(e) => e.preventDefault()}>
        {isLoading ? (
          <div className="loading-spinner-container">
            <VSCodeProgressRing />
          </div>
        ) : matches.length > 0 ? (
          matches.map((element, index) => (
            <div
              key={`match-element-${index}`}
              id={`match-element-${index}`}
              className={`match-option ${selectedElement === index && "selected-match"}`}
              onClick={() => setSelectedElement(index)}>
              {getOptionWithHighlight(element)}
            </div>
          ))
        ) : (
          <div className="empty-matches">no entries found</div>
        )}
      </div>
    </div>
  );
};
