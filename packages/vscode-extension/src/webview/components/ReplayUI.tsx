import { useRef, useState } from "react";
import "./ReplayUI.css";
import ReplayOverlay from "./ReplayOverlay";
import { RecordingData } from "../../common/Project";

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
  replayData: RecordingData;
  onClose: () => void;
};

export default function ReplayUI({ replayData, onClose }: ReplayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRewinding, setIsRewinding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <>
      <ReplayOverlay
        time={currentTime}
        isRewinding={isRewinding}
        isPlaying={isPlaying}
        isEnded={isEnded}
        startTime={startTime}
        setStartTime={setStartTime}
        setIsPlaying={setIsPlaying}
        setIsEnded={setIsEnded}
        setCurrentTime={setCurrentTime}
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
