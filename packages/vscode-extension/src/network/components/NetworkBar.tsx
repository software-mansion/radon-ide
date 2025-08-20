import classNames from "classnames";
import "./NetworkBar.css";
import { VscodeCheckbox } from "@vscode-elements/react-elements";
import IconButton from "../../webview/components/shared/IconButton";
import FilterInput from "./FilterInput";
import { useNetwork } from "../providers/NetworkProvider";
import { useNetworkFilter } from "../providers/NetworkFilterProvider";

function NetworkBar() {
  const { isRecording, toggleRecording, clearActivity } = useNetwork();

  const { filterInvert, isFilterVisible, toggleInvert, toggleFilterVisible } = useNetworkFilter();

  const handleInvertChange = (e: Event) => {
    toggleInvert();
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
          label:
            "Filter network requests (supports column:value format like 'status:200 method:post')",
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
            placeholder="Filter: search all columns or <column>:<value>"
            className="network-filter-input"
          />
          <VscodeCheckbox
            onChange={handleInvertChange}
            className="invert-checkbox"
            label="Invert"
            checked={filterInvert}
          />
        </div>
      )}
    </div>
  );
}

export default NetworkBar;
