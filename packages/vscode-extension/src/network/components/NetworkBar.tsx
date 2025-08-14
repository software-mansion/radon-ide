import classNames from "classnames";
import { useState } from "react";
import "./NetworkBar.css";
import { VscodeCheckbox } from "@vscode-elements/react-elements";
import IconButton from "../../webview/components/shared/IconButton";
import FilterInput from "./FilterInput";
import { useNetwork } from "../providers/NetworkProvider";
import { getFilterAutocompleteSuggestion } from "../utils/networkLogFormatters";

function NetworkBar() {
  const {
    isRecording,
    toggleRecording,
    clearActivity,
    toggleFilterVisible,
    isFilterVisible,
    filters,
    setFilters,
  } = useNetwork();

  const [suggestion, setSuggestion] = useState("");

  const handleInvertChange = (e: Event) => {
    // @ts-ignore - ignore type warning for web component
    setFilters({ ...filters, invert: e.target.checked });
  };

  const handleFilterTextChange = (value: string) => {
    setFilters({ ...filters, filterText: value });
    
    // Update autocomplete suggestion
    const newSuggestion = getFilterAutocompleteSuggestion(value);
    setSuggestion(newSuggestion);
  };

  return (
    <div className="network-bar">
      <IconButton
        onClick={toggleRecording}
        tooltip={{
          label: `${isRecording ? "Stop" : "Start"} recording network activity`,
          side: "bottom",
        }}>
        <span
          style={{ color: isRecording ? "var(--vscode-charts-red)" : "var(--swm-default-text)" }}
          className={classNames("codicon", isRecording ? "codicon-record" : "codicon-stop-circle")}
        />
      </IconButton>
      <IconButton
        onClick={clearActivity}
        tooltip={{
          label: "Clear network log",
          side: "bottom",
        }}>
        <span className="codicon codicon-circle-slash" />
      </IconButton>
      {/* <IconButton
        onClick={toggleTimelineVisible}
        tooltip={{
          label: isTimelineVisible ? "Hide timeline" : "Show timeline",
          side: "bottom",
        }}>
        <span className="codicon codicon-graph" />
      </IconButton> */}
      <IconButton
        onClick={toggleFilterVisible}
        tooltip={{
          label: "Filter network requests (supports column:value format like 'status:200 method:post')",
          side: "bottom",
        }}>
        <span
          className={classNames(
            "codicon",
            isFilterVisible ? "codicon-filter-filled" : "codicon-filter"
          )}
        />
      </IconButton>
      {isFilterVisible && (
        <div className="network-filter">
          <FilterInput
            value={filters.filterText}
            onChange={handleFilterTextChange}
            placeholder="Filter: status:200 method:post or search all columns"
            suggestion={suggestion}
            className="network-filter-input"
          />
          <VscodeCheckbox onChange={handleInvertChange} label="Invert" />
        </div>
      )}
    </div>
  );
}

export default NetworkBar;
