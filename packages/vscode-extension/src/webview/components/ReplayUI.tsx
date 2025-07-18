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
  const isRunningRef = useRef<boolean>(false);
  const [isRewinding, setIsRewinding] = useState(false);
  const { projectState } = useProject();
  const rotation = projectState.rotation;

  const drawToCanvas = useCanvasRenderer(rotation, canvasRef);
  const drawToCanvasRef = useRef(drawToCanvas);

  useEffect(() => {
    drawToCanvasRef.current = drawToCanvas;
  }, [drawToCanvas]);

  // The below effect implements the main logic of this component similar to MjpegImg.tsx
  // We manually control the video src and canvas rendering to ensure proper cleanup
  // and avoid memory leaks when the component is unmounted or reloaded.
  useEffect(() => {
    const canvas = canvasRef?.current;
    const sourceVideo = videoRef.current;
    if (!canvas || !sourceVideo) {
      return;
    }

    let animationFrameId: number | null = null;

    const updateCanvas = () => {
      drawToCanvasRef.current(sourceVideo);
    };

    const handleSourceLoad = () => {
      updateCanvas();
      // For video streams, continuously update the canvas with animation frames
      const animate = () => {
        if (isRunningRef.current) {
          updateCanvas();
          animationFrameId = requestAnimationFrame(animate);
        }
      };
      isRunningRef.current = true;
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleSourceError = () => {
      isRunningRef.current = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    // If video is already loaded and ready to play, start rendering
    if (sourceVideo.readyState >= 2) {
      handleSourceLoad();
    }

    sourceVideo.addEventListener("loadeddata", handleSourceLoad);
    sourceVideo.addEventListener("error", handleSourceError);

    return () => {
      isRunningRef.current = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      sourceVideo.removeEventListener("loadeddata", handleSourceLoad);
      sourceVideo.removeEventListener("error", handleSourceError);
    };
  }, [canvasRef, replayData.url]);

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
      <video
        ref={videoRef}
        src={replayData.url}
        style={{ display: "none" }}
        className="phone-screen replay-video"
      />
      {/* Main display canvas */}
      <canvas ref={canvasRef} className="phone-screen replay-video" />
      {isRewinding && <VHSRewind />}
    </span>
  );
}
