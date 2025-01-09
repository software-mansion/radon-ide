import { useRef, useState } from "react";
import "./ReplayUI.css";
import ReplayOverlay from "./ReplayOverlay";
import { MultimediaData } from "../../common/Project";

function VHSRewind() {
  return (
    <div className="phone-screen">
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
  const [isRewinding, setIsRewinding] = useState(false);

  return (
    <>
      <ReplayOverlay
        isRewinding={isRewinding}
        setIsRewinding={setIsRewinding}
        videoRef={videoRef}
        onClose={onClose}
        replayData={replayData}
      />
      <video ref={videoRef} src={replayData.url} className="phone-screen replay-video" />
      {isRewinding && <VHSRewind />}
    </>
  );
}
