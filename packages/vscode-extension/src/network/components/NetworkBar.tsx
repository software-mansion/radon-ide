import classNames from "classnames";
import "./NetworkBar.css";
import { VscodeTextfield } from "@vscode-elements/react-elements";
import IconButton from "../../webview/components/shared/IconButton";
import { useNetwork } from "../providers/NetworkProvider";

function NetworkBar() {
  const {
    isRecording,
    toggleRecording,
    clearActivity,
    toggleSearchVisible,
    toggleTimelineVisible,
    isSearchVisible,
    filters,
    setFilters,
  } = useNetwork();

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
          label: "Reset network activity",
          side: "bottom",
        }}>
        <span className="codicon codicon-circle-slash" />
      </IconButton>
      <IconButton
        onClick={toggleSearchVisible}
        tooltip={{
          label: "Filter domains",
          side: "bottom",
        }}>
        <span className="codicon codicon-filter" />
      </IconButton>
      <IconButton
        onClick={toggleTimelineVisible}
        tooltip={{
          label: "Show/Hide timeline visibility",
          side: "bottom",
        }}>
        <span className="codicon codicon-graph" />
      </IconButton>
      {isSearchVisible && (
        <div className="network-search">
          <VscodeTextfield
            value={filters.url ?? ""}
            onInput={(e) => {
              // @ts-ignore it works, types seem to be incorrect here
              setFilters({ ...filters, url: e.target.value });
            }}
            placeholder="Filter domain">
            <span className="codicon codicon-filter" />
          </VscodeTextfield>
        </div>
      )}
    </div>
  );
}

export default NetworkBar;
