import classNames from "classnames";
import { useEffect, useState } from "react";

import "./PreviewLoader.css";

import StartupMessageComponent from "./shared/StartupMessage";
import ProgressBar from "./shared/ProgressBar";

import { StartupMessage, StartupStageWeight } from "../../common/Project";
import { useProject } from "../providers/ProjectProvider";

const startupStageWeightSum = StartupStageWeight.map((item) => item.weight).reduce(
  (acc, cur) => acc + cur,
  0
);

function PreviewLoader({ onRequestShowPreview }: { onRequestShowPreview: () => void }) {
  const { projectState, project } = useProject();
  const [progress, setProgress] = useState(0);

  const [isLoadingSlowly, setIsLoadingSlowly] = useState(false);

  useEffect(() => {
    if (projectState.startupMessage === StartupMessage.Restarting) {
      setProgress(0);
    } else {
      const currentIndex = StartupStageWeight.findIndex(
        (item) => item.StartupMessage === projectState.startupMessage
      );
      const currentWeight = StartupStageWeight[currentIndex].weight;
      const startupStageWeightSumUntilNow = StartupStageWeight.slice(0, currentIndex)
        .map((item) => item.weight)
        .reduce((acc, cur) => acc + cur, 0);

      let progressComponent = 0;

      if (projectState.stageProgress !== undefined) {
        progressComponent = projectState.stageProgress;
      }
      setProgress(
        ((startupStageWeightSumUntilNow + progressComponent * currentWeight) /
          startupStageWeightSum) *
          100
      );
    }
  }, [projectState]);

  useEffect(() => {
    setIsLoadingSlowly(false);

    // we show the slow loading message after 30 seconds for each phase,
    // but for the native build phase we show it after 5 seconds.
    let timeoutMs = 30_000;
    if (projectState.startupMessage === StartupMessage.Building) {
      timeoutMs = 5_000;
    }

    const timeoutHandle = setTimeout(() => {
      setIsLoadingSlowly(true);
    }, timeoutMs);

    return () => timeoutHandle && clearTimeout(timeoutHandle);
  }, [projectState.startupMessage]);

  function handleLoaderClick() {
    if (projectState.startupMessage === StartupMessage.Building) {
      project.focusBuildOutput();
    } else if (projectState.startupMessage === StartupMessage.WaitingForAppToLoad) {
      onRequestShowPreview();
    } else {
      project.focusExtensionLogsOutput();
    }
  }

  return (
    <>
      <button className="preview-loader-container" onClick={handleLoaderClick}>
        <div className="preview-loader-button-group">
          <StartupMessageComponent
            className={classNames(
              "preview-loader-message",
              isLoadingSlowly && "preview-loader-slow-progress"
            )}>
            {projectState.startupMessage}
            {isLoadingSlowly && projectState.startupMessage === StartupMessage.Building
              ? " (open logs)"
              : ""}
          </StartupMessageComponent>
          {projectState.stageProgress !== undefined && (
            <div className="preview-loader-stage-progress">
              {(projectState.stageProgress * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </button>
      <ProgressBar progress={progress} />
    </>
  );
}

export default PreviewLoader;
