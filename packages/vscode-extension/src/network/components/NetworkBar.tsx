import classNames from "classnames";
import "./NetworkBar.css";
import { VscodeCheckbox } from "@vscode-elements/react-elements";
import IconButton from "../../webview/components/shared/IconButton";
import FilterInput from "./FilterInput";
import { useNetwork } from "../providers/NetworkProvider";
import { useNetworkFilter } from "../providers/NetworkFilterProvider";

function NetworkBar() {
  const { isTracking, toggleTracking, clearActivity } = useNetwork();

  const { filterInvert, isFilterVisible, toggleInvert, toggleFilterVisible } = useNetworkFilter();

  return (
    <div className="network-bar">
      <IconButton
        onClick={toggleTracking}
        tooltip={{
          label: `${isTracking ? "Stop" : "Start"} recording network activity`,
          side: "bottom",
        }}>
        <span
          style={{ color: isTracking ? "var(--vscode-charts-red)" : "var(--swm-default-text)" }}
          className={classNames("codicon", isTracking ? "codicon-record" : "codicon-stop-circle")}
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
          <FilterInput placeholder="Filter: search all columns or <column>:<value>" />
          <VscodeCheckbox
            onChange={toggleInvert}
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
