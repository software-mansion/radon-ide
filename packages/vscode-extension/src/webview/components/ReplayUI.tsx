import React, { useEffect, useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";
import "./ReplayUI.css";
import Button from "./shared/Button";
import ReplayOverlay from "./ReplayOverlay";
import { RecordingData } from "../../common/Project";

const INITIAL_REPLAY_LENGTH_SEC = 5;

type ReplayVideoProps = {
  replayData: RecordingData;
  onClose: () => void;
};

/**
 * Setting negative playbackRate doesn't work in VSCode's WebView, so the rewinding
 * is done using requestAnimationFrame with a custom acceleration curve, such that
 * the rewinding speeds up over time and also takes a fixed amount of time to rewind.
 */
function acceleratedRewind(
  video: HTMLVideoElement,
  fromTime: number,
  toTime: number,
  readyCallback: () => void
) {
  const rewindTimeSec = 1.6;

  const v0 = 0.1;
  const vFinal = 2 / rewindTimeSec - v0;
  const acc = (vFinal - v0) / rewindTimeSec;

  const rewindTime = fromTime - toTime;
  video.currentTime = fromTime;

  let startTimeMs: number | null = null;
  function frame(timestampMs: number) {
    if (!startTimeMs) {
      startTimeMs = timestampMs;
    }
    const elapsedSec = Math.min((timestampMs - startTimeMs) / 1000, rewindTimeSec);

    const progress = v0 * elapsedSec + 0.5 * acc * elapsedSec * elapsedSec;

    if (elapsedSec < rewindTimeSec) {
      video.currentTime = Math.max(0, toTime + rewindTime * (1 - progress));
      requestAnimationFrame(frame);
    } else {
      console.log("Fin rewind", toTime);
      video.currentTime = toTime;
      readyCallback();
    }
  }
  requestAnimationFrame(frame);
}

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

interface SeekbarProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  startTime: number;
}

function isVideoPlaying(videoElement: HTMLVideoElement) {
  return !videoElement.paused && !videoElement.ended && videoElement.readyState > 2;
}

function Seekbar({ videoRef, startTime }: SeekbarProps) {
  const [progress, setProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const seekbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      const progress = ((video.currentTime - startTime) / (video.duration - startTime)) * 100;
      setProgress(progress);
    };
    updateProgress();

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [videoRef, startTime]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const seekbar = seekbarRef.current;
    if (!seekbar) return;

    const rect = seekbar.getBoundingClientRect();
    const seekPosition = (e.clientX - rect.left) / rect.width;
    const video = videoRef.current;
    if (video) {
      video.currentTime = startTime + seekPosition * (video.duration - startTime);
    }
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleSeek(e);
    }
  };

  return (
    <div
      ref={seekbarRef}
      className="seekbar"
      onClick={handleSeek}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}>
      <div className="progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}

interface LengthSelectorProps {
  startTime: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  setStartTime: (startTime: number) => void;
}

function LengthSelector({ startTime, videoRef, setStartTime }: LengthSelectorProps) {
  const videoDuration = videoRef.current?.duration ?? 0;

  const options = [5, 10, 30, 0].filter((l) => l < videoDuration);
  const value = startTime === 0 ? 0 : videoDuration - startTime;

  function str(length: number) {
    if (length === 0) {
      return "Full";
    }
    return `${length}s.`;
  }

  function onValueChange(value: string) {
    if (value === "Full") {
      setStartTime(0);
    } else {
      const newStartTime = videoDuration - parseInt(value);
      setStartTime(newStartTime);
    }
  }

  return (
    <Select.Root value={str(value)} onValueChange={onValueChange}>
      <Select.Trigger className="len-select-trigger" aria-label="Food">
        <Select.Value>{str(value)}</Select.Value>
        <Select.Icon className="len-select-icon">
          <span className="codicon codicon-chevron-down" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="len-select-content">
          <Select.Viewport className="len-select-viewport">
            {options.map((length) => (
              <Select.Item value={str(length)} key={length} className="len-select-item">
                <Select.ItemText className="len-select-item-text">{str(length)}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default function ReplayUI({ replayData, onClose }: ReplayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRewinding, setIsRewinding] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  function stepForward() {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime += 1 / 60;
    }
  }

  function stepBackward() {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime -= 1 / 60;
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) {
      return;
    }

    function handleLoadedMetadata() {
      setIsLoaded(true);
      setIsRewinding(true);
      const newStartTime = Math.max(0, video!.duration - INITIAL_REPLAY_LENGTH_SEC);
      setStartTime(newStartTime);
      acceleratedRewind(video!, video!.duration, newStartTime, () => {
        setIsRewinding(false);
        videoRef.current!.play();
      });
    }

    function handleTimeUpdate() {
      setIsPlaying(isVideoPlaying(video!));
      setIsEnded(video!.ended);
      setCurrentTime(video!.currentTime);
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handleTimeUpdate);
    video.addEventListener("pause", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handleTimeUpdate);
      video.removeEventListener("pause", handleTimeUpdate);
    };
  }, [replayData.url]);

  let actionIcon = "start";
  if (isEnded) {
    actionIcon = "restart";
  } else if (isPlaying) {
    actionIcon = "pause";
  }

  return (
    <>
      <ReplayOverlay
        time={currentTime}
        startTime={startTime}
        onClose={onClose}
        replayData={replayData}
      />
      <video ref={videoRef} src={replayData.url} className="phone-screen replay-video" />
      {isRewinding && <VHSRewind />}
      {!isRewinding && (
        <div className="phone-screen">
          <div className="replay-controls">
            <span className="replay-controls-pad" />
            <LengthSelector videoRef={videoRef} startTime={startTime} setStartTime={setStartTime} />
            <Button
              onClick={() => {
                if (videoRef.current) {
                  if (isVideoPlaying(videoRef.current)) {
                    videoRef.current.pause();
                  } else {
                    videoRef.current.play();
                  }
                }
              }}>
              <span className={`codicon codicon-debug-${actionIcon}`} />
            </Button>
            <Seekbar videoRef={videoRef} startTime={startTime} />
            <div style={{ display: "flex", flexDirection: "row" }}>
              <Button onClick={stepBackward}>
                <span className="codicon codicon-triangle-left" />
              </Button>
              <Button onClick={stepForward}>
                <span className="codicon codicon-triangle-right" />
              </Button>
            </div>
            <span className="replay-controls-pad" />
          </div>
        </div>
      )}
    </>
  );
}
