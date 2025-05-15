
import { useUtils } from "../providers/UtilsProvider";
import "./Debugger.css";
import IconButton from "./shared/IconButton";

function Debugger() {
  const { focusDebugConsole } = useUtils();

  return (
    <div className="debugger-container">
      <p className="debugger-label debugger-shadow">Paused in debugger</p>
      <div className="debugger-button-group">
        <IconButton
          // Frytki this is now device specific 
          onClick={() => project.resumeDebugger()}
          tooltip={{
            label: "Resume execution",
            side: "bottom",
          }}>
          <span className="codicon codicon-debug-continue" />
        </IconButton>
        <IconButton
          onClick={() => project.stepOverDebugger()}
          tooltip={{
            label: "Step over",
            side: "bottom",
          }}>
          <span className="codicon codicon-debug-step-over" />
        </IconButton>
        <IconButton
          onClick={() => focusDebugConsole()}
          tooltip={{
            label: "Open debugger console",
            side: "bottom",
          }}>
          <span className="codicon codicon-debug-console" />
        </IconButton>
      </div>
    </div>
  );
}

export default Debugger;
