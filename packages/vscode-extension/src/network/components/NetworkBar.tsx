import classNames from "classnames";
import IconButton from "../../webview/components/shared/IconButton";
import { useNetwork } from "../providers/NetworkProvider";

function NetworkBar() {
  const { isRecording, toggleRecording, clearActivity, toggleShowSearch, toggleShowChart } =
    useNetwork();

  return (
    <>
      <IconButton
        onClick={toggleRecording}
        tooltip={{
          label: isRecording
            ? "Stop recording network activity"
            : "Start recording network activity",
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
        onClick={toggleShowSearch}
        tooltip={{
          label: "Search network activity",
          side: "bottom",
        }}>
        <span className="codicon codicon-search" />
      </IconButton>
      <IconButton
        onClick={toggleShowChart}
        tooltip={{
          label: "Show/Hide timeline visibility",
          side: "bottom",
        }}>
        <span className="codicon codicon-graph" />
      </IconButton>
    </>
  );
}

export default NetworkBar;
