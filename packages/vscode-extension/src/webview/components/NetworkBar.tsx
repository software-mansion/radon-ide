import { useState } from "react";
import IconButton from "./shared/IconButton";
import { useNetwork } from "../providers/NetworkProvider";

const NetworkBar = () => {
  const { isRecording, toggleRecording, showFilter, toggleShowFilter, clearActivity } =
    useNetwork();
  const [showSearch, setShowSearch] = useState(false);

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
          className={`codicon ${isRecording ? "codicon-record" : "codicon-stop-circle"}`}
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
        onClick={toggleShowFilter}
        tooltip={{
          label: "Show network activity filter",
          side: "bottom",
        }}>
        <span
          style={{ color: showFilter ? "var(--vscode-charts-blue)" : "var(--swm-default-text)" }}
          className="codicon codicon-filter"
        />
      </IconButton>
      <IconButton
        onClick={() => setShowSearch(!showSearch)}
        tooltip={{
          label: "Search network activity",
          side: "bottom",
        }}>
        <span className="codicon codicon-search" />
      </IconButton>
      <IconButton
        onClick={() => setShowSearch(!showSearch)}
        tooltip={{
          label: "Upload network activity",
          side: "bottom",
        }}>
        <span className="codicon codicon-cloud-upload" />
      </IconButton>
      <IconButton
        onClick={() => setShowSearch(!showSearch)}
        tooltip={{
          label: "Download network activity",
          side: "bottom",
        }}>
        <span className="codicon codicon-cloud-download" />
      </IconButton>
    </>
  );
};

export default NetworkBar;
