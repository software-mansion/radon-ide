import { RecordingData } from "../../common/Project";
import { useUtils } from "../providers/UtilsProvider";
import "./ReplayOverlay.css";
import Button from "./shared/Button";

type ReplayOverlayProps = {
  replayData: RecordingData;
  time: number;
  onClose: () => void;
};

export default function ReplayOverlay({ time, onClose, replayData }: ReplayOverlayProps) {
  const utils = useUtils();

  // shifting the time a bit here such that it displays the final value properly despite using Math.floor
  const timeSec = Math.floor(time + 0.05);
  const paddedTime = timeSec.toString().padStart(2, "0");
  return (
    <div className="replay-overlay">
      <div className="replay-corner replay-top-left" />
      <div className="replay-corner replay-top-right" />
      <div className="replay-corner replay-bottom-left" />
      <div className="replay-corner replay-bottom-right" />
      <div className="replay-rec-indicator">
        <div className="replay-rec-dot" />
        <span>REPLAY 0:{paddedTime}</span>
      </div>
      <Button onClick={onClose} className="replay-close">
        <span className="codicon codicon-chrome-close" />
      </Button>
      <Button onClick={() => utils.saveVideoRecording(replayData)} className="replay-save">
        <span className="codicon codicon-folder-opened" /> Save
      </Button>
    </div>
  );
}
