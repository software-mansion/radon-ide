import classNames from "classnames";
import { useEffect, useState } from "react";

import "./PreviewLoader.css";

import StartupMessageComponent from "./shared/StartupMessage";
import ProgressBar from "./shared/ProgressBar";

import {
  DeviceSessionStateStarting,
  StartupMessage,
  StartupStageWeight,
} from "../../common/Project";
import { useProject } from "../providers/ProjectProvider";
import Button from "./shared/Button";
import { useDevices } from "../providers/DevicesProvider";

const startupStageWeightSum = StartupStageWeight.map((item) => item.weight).reduce(
  (acc, cur) => acc + cur,
  0
);

function PreviewLoader({
  startingSessionState,
  onRequestShowPreview,
}: {
  onRequestShowPreview: () => void;

  startingSessionState: DeviceSessionStateStarting;
}) {
  const { project } = useProject();
  const { deviceSessionsManager } = useDevices();
  const [progress, setProgress] = useState(0);

  const [isLoadingSlowly, setIsLoadingSlowly] = useState(false);

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

  function handleLoaderClick() {
    if (startupMessage === StartupMessage.Building) {
      project.focusBuildOutput();
    } else if (startupMessage === StartupMessage.WaitingForAppToLoad) {
      onRequestShowPreview();
    } else {
      project.focusExtensionLogsOutput();
    }
  }

  const isWaitingForApp = startupMessage === StartupMessage.WaitingForAppToLoad;
  const isBuilding = startupMessage === StartupMessage.Building;

  return (
    <>
      <div className="preview-loader-center-pad" />
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
      <div className="preview-loader-center-pad">
        {isLoadingSlowly && isWaitingForApp && (
          <>
            <div className="preview-loader-submessage">
              Loading app takes longer than expected. If nothing happens after a while try the below
              options to troubleshoot:
            </div>
            <div className="preview-loader-waiting-actions">
              <Button type="secondary" onClick={() => project.focusExtensionLogsOutput()}>
                <span className="codicon codicon-output" /> Open Radon IDE Logs
              </Button>
              <Button type="secondary" onClick={onRequestShowPreview}>
                <span className="codicon codicon-open-preview" /> Force show device screen
              </Button>
              <a href="https://ide.swmansion.com/docs/guides/troubleshooting" target="_blank">
                <Button type="secondary">
                  <span className="codicon codicon-browser" /> Visit troubleshoot guide
                </Button>
              </a>
              <Button
                type="secondary"
                onClick={() => deviceSessionsManager.reloadCurrentSession("rebuild")}>
                <span className="codicon codicon-refresh" /> Clean rebuild project
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default PreviewLoader;
