import { useRef, useState } from "react";
import "./ReplayUI.css";
import ReplayOverlay from "./ReplayOverlay";

import MediaCanvas from "../Preview/MediaCanvas";
import { MultimediaData } from "../../common/State";

function VHSRewind() {
  return (
    <div className="phone-screen vhs-wrapper" data-testid="vhs-rewind">
      <div className="vhs-lines"></div>
      <div className="crt-lines"></div>
      <div className="vhs-bg">
        <div className="vhs-text">
          <div className="vhs-noise" />
          {"\u25C0\u25C0"}
          <br /> REWIND
        </div>
      </div>
    </div>
  );
}

type ReplayVideoProps = {
  replayData: MultimediaData;
  onClose: () => void;
};

export default function ReplayUI({ replayData, onClose }: ReplayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRewinding, setIsRewinding] = useState(false);

  return (
    <span className="replay-ui-wrapper">
      <ReplayOverlay
        isRewinding={isRewinding}
        setIsRewinding={setIsRewinding}
        videoRef={videoRef}
        onClose={onClose}
        replayData={replayData}
      />
      {/* Hidden source video for loading the video stream */}
      {/* Video's dimensions and orientation are dependent on the current device rotation
          because of how the video saving is handled. */}
      <video
        ref={videoRef}
        src={replayData.url}
        style={{ display: "none" }}
        className="phone-screen replay-video"
      />
      {/* Main display canvas */}
      <MediaCanvas
        ref={canvasRef}
        mediaRef={videoRef}
        src={replayData.url}
        className="phone-screen replay-video"
      />
      {/* VHS rewind effect on top of MediaCanvas */}
      {isRewinding && <VHSRewind />}
    </span>
  );
}
