import classNames from "classnames";
import "./NetworkBar.css";
import {
  VscodeTextfield,
  VscodeSingleSelect,
  VscodeOption,
  VscodeCheckbox,
} from "@vscode-elements/react-elements";
import IconButton from "../../webview/components/shared/IconButton";
import { useNetwork } from "../providers/NetworkProvider";
import { FILTER_TYPES } from "../utils/networkLogFormatters";

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

  const handleTypeChange = (e: Event) => {
    // @ts-ignore - ignore type warning for web component
    setFilters({ ...filters, filterType: e.target.value });
  };

  const handleInvertChange = (e: Event) => {
    // @ts-ignore - ignore type warning for web component
    setFilters({ ...filters, invert: e.target.checked });
  };

  const handleValueChange = (e: Event) => {
    // @ts-ignore - ignore type warning for web component
    const value = e.target.value;
    setFilters({ ...filters, filterValue: value.trim() });
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
          label: "Filter network requests",
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
          <VscodeSingleSelect
            className="network-filter-select"
            onChange={handleTypeChange}
            value={filters.filterType}>
            {FILTER_TYPES.map((filterType) => (
              <VscodeOption key={filterType} value={filterType}>
                {filterType}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>

          <VscodeTextfield
            value={filters.filterValue ?? ""}
            onInput={handleValueChange}
            placeholder={`Filter by ${filters.filterType}`}
          />
          <VscodeCheckbox
            onChange={handleInvertChange}
            label="Invert"
          />
        </div>
      )}
    </div>
  );
}

export default NetworkBar;
