import { useRef, useState, useEffect } from "react";
import "./ReplayUI.css";
import ReplayOverlay from "./ReplayOverlay";
import { MultimediaData } from "../../common/Project";
import useCanvasRenderer from "../hooks/useCanvasRenderer";
import { useProject } from "../providers/ProjectProvider";

function VHSRewind() {
  return (
    <div className="phone-screen vhs-wrapper">
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
  const { projectState } = useProject();
  const rotation = projectState.rotation;

  const drawToCanvas = useCanvasRenderer(rotation, canvasRef);

  useEffect(() => {
    const sourceVideo = videoRef.current;
    const canvas = canvasRef.current;
    if (!sourceVideo || !canvas) {
      return;
    }

    let animationFrameId: number;
    let isAnimating = false;

    const updateCanvas = () => {
      drawToCanvas(sourceVideo);
      if (isAnimating) {
        animationFrameId = requestAnimationFrame(updateCanvas);
      }
    };

    const handleSourceLoad = () => {
      if (isAnimating) {
        cancelAnimationFrame(animationFrameId);
      }

      isAnimating = true;
      updateCanvas();
    };

    const handleSourceError = () => {
      if (isAnimating) {
        cancelAnimationFrame(animationFrameId);
        isAnimating = false;
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    // If video is already loaded and ready to play, dispatch drawHandler
    if (sourceVideo.readyState >= 2) {
      handleSourceLoad();
    }

    sourceVideo.addEventListener("loadeddata", handleSourceLoad);
    sourceVideo.addEventListener("error", handleSourceError);

    return () => {
      if (isAnimating) {
        cancelAnimationFrame(animationFrameId);
        isAnimating = false;
      }
      sourceVideo.removeEventListener("loadeddata", handleSourceLoad);
      sourceVideo.removeEventListener("error", handleSourceError);
    };
  }, [canvasRef, rotation, drawToCanvas]);

  return (
    <span className="replay-ui-wrapper">
      <ReplayOverlay
        isRewinding={isRewinding}
        setIsRewinding={setIsRewinding}
        videoRef={videoRef}
        onClose={onClose}
        replayData={replayData}
      />
      <video
        ref={videoRef}
        src={replayData.url}
        style={{ display: "none" }}
        className="phone-screen replay-video"
      />
      <canvas ref={canvasRef} className="phone-screen replay-video" />
      {isRewinding && <VHSRewind />}
    </span>
  );
}
