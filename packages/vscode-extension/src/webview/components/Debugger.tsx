import { useProject } from "../providers/ProjectProvider";
import "./Debugger.css";
import IconButton from "./shared/IconButton";

function Debugger() {
  const { project } = useProject();
  return (
    <div className="debugger-container" data-testid="app-debugger-container">
      <p className="debugger-label debugger-shadow">Paused in debugger</p>
      <div className="debugger-button-group">
        <IconButton
          onClick={() => project.resumeDebugger()}
          dataTest="debug-resume"
          tooltip={{
            label: "Resume execution",
            side: "bottom",
          }}>
          <span className="codicon codicon-debug-continue" />
        </IconButton>
        <IconButton
          onClick={() => project.stepOverDebugger()}
          dataTest="debug-step-over"
          tooltip={{
            label: "Step over",
            side: "bottom",
          }}>
          <span className="codicon codicon-debug-step-over" />
        </IconButton>
        <IconButton
          onClick={() => project.stepIntoDebugger()}
          dataTest="debug-step-into"
          tooltip={{
            label: "Step into",
            side: "bottom",
          }}>
          <span className="codicon codicon-debug-step-into" />
        </IconButton>
        <IconButton
          onClick={() => project.stepOutDebugger()}
          dataTest="debug-step-out"
          tooltip={{
            label: "Step out",
            side: "bottom",
          }}>
          <span className="codicon codicon-debug-step-out" />
        </IconButton>
        <IconButton
          onClick={() => project.focusDebugConsole()}
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
