import classNames from "classnames";
import { useEffect, useRef } from "react";
import "./NetworkBar.css";
import { VscodeTextfield, VscodeSingleSelect, VscodeOption } from "@vscode-elements/react-elements";
import type { VscodeSingleSelect as VscodeSingleSelectElement } from "@vscode-elements/elements/dist/vscode-single-select/vscode-single-select";
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

  const selectRef = useRef<VscodeSingleSelectElement>(null);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      return;
    }

    const handleChange = () => {
      // @ts-ignore - ignore type warning for web component
      setFilters({ ...filters, filterType: selectElement.value });
    };

    selectElement.addEventListener("change", handleChange);

    return () => {
      selectElement.removeEventListener("change", handleChange);
    };
  }, [filters, setFilters]);

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
            ref={selectRef}
            value={filters.filterType}>
            {FILTER_TYPES.map((filterType) => (
              <VscodeOption key={filterType} value={filterType}>
                {filterType}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>

          <VscodeTextfield
            value={filters.filterValue ?? ""}
            onInput={(e) => {
              // @ts-ignore it works, types seem to be incorrect here
              setFilters({ ...filters, filterValue: e.target.value });
            }}
            placeholder={`Filter by ${filters.filterType}`}
          />
        </div>
      )}
    </div>
  );
}

export default NetworkBar;
