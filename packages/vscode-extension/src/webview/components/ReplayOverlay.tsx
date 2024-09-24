import { useUtils } from "../providers/UtilsProvider";
import "./ReplayOverlay.css";
import Button from "./shared/Button";

type ReplayOverlayProps = {
  time: number;
  onClose: () => void;
};

export default function ReplayOverlay({ time, onClose }: ReplayOverlayProps) {
  const utils = useUtils();

  // shifting the time a bit here such that it displays the final value properly despite using Math.floor
  const timeSec = Math.floor(time + 0.05);
  const paddedTime = timeSec.toString().padStart(2, "0");
  return (
    <div className="replay-overlay">
      <div className="corner top-left" />
      <div className="corner top-right" />
      <div className="corner bottom-left" />
      <div className="corner bottom-right" />
      <div className="rec-indicator">
        <div className="rec-dot" />
        <span>REPLAY 0:{paddedTime}</span>
      </div>
      <div className="replay-fns">
        <Button onClick={() => utils.downloadFile("http://sdkjfh")}>
          <span className="codicon codicon-folder-opened" />
          Save
        </Button>
        <Button onClick={onClose}>
          <span className="codicon codicon-chrome-close" />
        </Button>
      </div>
    </div>
  );
}
