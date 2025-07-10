import { DeviceRotationType } from "../../common/Project";
import { useProject } from "../providers/ProjectProvider";
import "./Debugger.css";
import IconButton from "./shared/IconButton";

const ROTATION_STYLES = {
  [DeviceRotationType.Portrait]: "rotate(0deg)",
  [DeviceRotationType.LandscapeLeft]: "rotate(90deg)",
  [DeviceRotationType.LandscapeRight]: "rotate(-90deg)",
  [DeviceRotationType.PortraitUpsideDown]: "rotate(0deg)",
} as const;

function Debugger() {
  const { project, projectState } = useProject();
  const rotationStyle = ROTATION_STYLES[projectState.rotation];

  return (
    <div className="debugger-container" style={{transform: rotationStyle}}>
      <p className="debugger-label debugger-shadow">Paused in debugger</p>
      <div className="debugger-button-group">
        <IconButton
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
