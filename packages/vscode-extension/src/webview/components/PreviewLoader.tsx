import classNames from "classnames";
import { useEffect, useState, useRef } from "react";

import "./PreviewLoader.css";

import StartupMessageComponent from "./shared/StartupMessage";
import ProgressBar from "./shared/ProgressBar";

import {
  DeviceSessionStateStarting,
  DeviceRotationType,
  StartupMessage,
  StartupStageWeight,
} from "../../common/Project";
import { useProject } from "../providers/ProjectProvider";
import Button from "./shared/Button";
import { useDevices } from "../providers/DevicesProvider";
import { Output } from "../../common/OutputChannel";
import { DevicePlatform } from "../../common/DeviceManager";

const startupStageWeightSum = StartupStageWeight.map((item) => item.weight).reduce(
  (acc, cur) => acc + cur,
  0
);

const BREAKPOINT_SMALL_LANDSCAPE = 450;
const BREAKPOINT_MEDIUM_LANDSCAPE = 700;
const BREAKPOINT_SMALL_PORTRAIT = 475;
const BREAKPOINT_MEDIUM_PORTRAIT = 600;

enum BreakpointSize {
  Small = "small",
  Medium = "medium",
  Large = "",
}

const BREAKPOINT_CLASSES_ROTATED = {
  [BREAKPOINT_SMALL_LANDSCAPE]: BreakpointSize.Small,
  [BREAKPOINT_MEDIUM_LANDSCAPE]: BreakpointSize.Medium,
} as const;

const BREAKPOINT_CLASSES_PORTRAIT = {
  [BREAKPOINT_SMALL_PORTRAIT]: BreakpointSize.Small,
  [BREAKPOINT_MEDIUM_PORTRAIT]: BreakpointSize.Medium,
} as const;

const TOOLTIPS = {
  logs: { label: "Open Radon IDE Logs", side: "top" },
  preview: { label: "Force show device screen", side: "top" },
  troubleshoot: { label: "Visit troubleshoot guide", side: "top" },
  rebuild: { label: "Clean rebuild project", side: "top" },
} as const;

const ROTATION_STYLES = {
  [DeviceRotationType.Portrait]: "rotate(0deg)",
  [DeviceRotationType.LandscapeLeft]: "rotate(90deg)",
  [DeviceRotationType.LandscapeRight]: "rotate(-90deg)",
  [DeviceRotationType.PortraitUpsideDown]: "rotate(0deg)",
} as const;

function PreviewLoader({
  startingSessionState,
  onRequestShowPreview,
  backgroundElementRef,
}: {
  onRequestShowPreview: () => void;
  startingSessionState: DeviceSessionStateStarting;
  backgroundElementRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { project, selectedDeviceSession } = useProject();
  const { deviceSessionsManager } = useDevices();
  const [progress, setProgress] = useState(0);
  const platform = selectedDeviceSession?.deviceInfo.platform;

  const [isLoadingSlowly, setIsLoadingSlowly] = useState(false);
  const [breakpointSize, setBreakpointSize] = useState<BreakpointSize>(BreakpointSize.Large);

  const parentRef = useRef<HTMLDivElement>(null);

  const startupMessage = startingSessionState.startupMessage;
  const stageProgress = startingSessionState.stageProgress;

  useEffect(() => {
    if (startupMessage === StartupMessage.Restarting) {
      setProgress(0);
    } else {
      const currentIndex = StartupStageWeight.findIndex(
        (item) => item.StartupMessage === startupMessage
      );
      const currentWeight = StartupStageWeight[currentIndex].weight;
      const startupStageWeightSumUntilNow = StartupStageWeight.slice(0, currentIndex)
        .map((item) => item.weight)
        .reduce((acc, cur) => acc + cur, 0);

      let progressComponent = 0;

      if (stageProgress !== undefined) {
        progressComponent = stageProgress;
      }
      setProgress(
        ((startupStageWeightSumUntilNow + progressComponent * currentWeight) /
          startupStageWeightSum) *
          100
      );
    }
  }, [startingSessionState]);

  useEffect(() => {
    setIsLoadingSlowly(false);

    // we show the slow loading message after 12 seconds for each phase,
    // but for the native build phase we show it after 5 seconds.
    let timeoutMs = 12_000;
    if (startupMessage === StartupMessage.Building) {
      timeoutMs = 5_000;
    }

    const timeoutHandle = setTimeout(() => {
      setIsLoadingSlowly(true);
    }, timeoutMs);

    return () => timeoutHandle && clearTimeout(timeoutHandle);
  }, [startupMessage]);

  // only update state when crossing thresholds
  useEffect(() => {
    const backgroundElement = backgroundElementRef.current;
    if (!backgroundElement) {
      return;
    }

    const checkBreakpoint = () => {
      const height = backgroundElement.clientHeight;
      const isRotated =
        selectedDeviceSession?.rotation === DeviceRotationType.LandscapeLeft ||
        selectedDeviceSession?.rotation === DeviceRotationType.LandscapeRight;

      const breakpointClasses = isRotated
        ? BREAKPOINT_CLASSES_ROTATED
        : BREAKPOINT_CLASSES_PORTRAIT;

      let newBreakpointSize = BreakpointSize.Large;

      // Check breakpoints in order (small first, medium second)
      for (const [breakpoint, className] of Object.entries(breakpointClasses)) {
        if (height < Number(breakpoint)) {
          newBreakpointSize = className as BreakpointSize;
          break;
        }
      }

      // Only update state if breakpoint changed
      setBreakpointSize((prevSize) => {
        if (prevSize !== newBreakpointSize) {
          return newBreakpointSize;
        }
        return prevSize;
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      checkBreakpoint();
    });

    resizeObserver.observe(backgroundElement);
    checkBreakpoint();

    return () => {
      resizeObserver.disconnect();
    };
  }, [backgroundElementRef]);

  function handleLoaderClick() {
    if (startupMessage === StartupMessage.Building) {
      const logTarget =
        platform === DevicePlatform.IOS
          ? Output.BuildIos
          : platform === DevicePlatform.Android
            ? Output.BuildAndroid
            : Output.Ide;
      project.focusOutput(logTarget);
    } else if (startupMessage === StartupMessage.WaitingForAppToLoad) {
      onRequestShowPreview();
    } else {
      project.focusOutput(Output.Ide);
    }
  }

  const isWaitingForApp = startupMessage === StartupMessage.WaitingForAppToLoad;
  const isBuilding = startupMessage === StartupMessage.Building;
  const isRotated =
    selectedDeviceSession?.rotation === DeviceRotationType.LandscapeLeft ||
    selectedDeviceSession?.rotation === DeviceRotationType.LandscapeRight;

  const isSmallBreakpoint = breakpointSize === BreakpointSize.Small;
  const breakpointClass = breakpointSize;

  const rotationStyle = selectedDeviceSession?.rotation
    ? ROTATION_STYLES[selectedDeviceSession.rotation]
    : ROTATION_STYLES[DeviceRotationType.Portrait];

  return (
    <div
      ref={parentRef}
      className={`preview-loader-wrapper ${isRotated ? "rotated" : "portrait"} ${breakpointClass}`}
      style={{ transform: rotationStyle }}>
      <div className="preview-loader-load-info">
        <button className="preview-loader-container" onClick={handleLoaderClick}>
          <div className="preview-loader-button-group">
            <StartupMessageComponent
              className={classNames(
                "preview-loader-message",
                isLoadingSlowly && "preview-loader-slow-progress"
              )}>
              {startingSessionState.startupMessage}
              {isLoadingSlowly && isBuilding ? " (open logs)" : ""}
            </StartupMessageComponent>
            {startingSessionState.stageProgress !== undefined && (
              <div className="preview-loader-stage-progress">
                {(startingSessionState.stageProgress * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </button>
        <ProgressBar progress={progress} />
        {isLoadingSlowly && isWaitingForApp && (
          <div className="preview-loader-submessage">
            Loading app takes longer than expected. If nothing happens after a while try the below
            options to troubleshoot:
          </div>
        )}
      </div>
      {isLoadingSlowly && isWaitingForApp && (
        <div className={`preview-loader-waiting-actions`}>
          <Button
            type="secondary"
            onClick={() => project.focusOutput(Output.Ide)}
            tooltip={isSmallBreakpoint ? TOOLTIPS.logs : undefined}>
            <span className="codicon codicon-output" />{" "}
            <span className="button-text">{TOOLTIPS.logs.label}</span>
          </Button>
          <Button
            type="secondary"
            onClick={onRequestShowPreview}
            tooltip={isSmallBreakpoint ? TOOLTIPS.preview : undefined}>
            <span className="codicon codicon-open-preview" />{" "}
            <span className="button-text">{TOOLTIPS.preview.label}</span>
          </Button>
          <a href="https://ide.swmansion.com/docs/guides/troubleshooting" target="_blank">
            <Button
              type="secondary"
              tooltip={isSmallBreakpoint ? TOOLTIPS.troubleshoot : undefined}>
              <span className="codicon codicon-browser" />{" "}
              <span className="button-text">{TOOLTIPS.troubleshoot.label}</span>
            </Button>
          </a>
          <Button
            type="secondary"
            onClick={() => deviceSessionsManager.reloadCurrentSession("rebuild")}
            tooltip={isSmallBreakpoint ? TOOLTIPS.rebuild : undefined}>
            <span className="codicon codicon-refresh" />{" "}
            <span className="button-text">{TOOLTIPS.rebuild.label}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default PreviewLoader;
