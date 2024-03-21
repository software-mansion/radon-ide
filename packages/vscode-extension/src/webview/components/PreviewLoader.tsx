import { useEffect, useState } from "react";

import "./PreviewLoader.css";

import StartupMessageComponent from "./shared/StartupMessage";
import ProgressBar from "./shared/ProgressBar";

import { StartupMessage, StartupStageWeight } from "../../common/Project";
import { useProject } from "../providers/ProjectProvider";
import IconButton from "./shared/IconButton";

const startupStageWeightSum = StartupStageWeight.map((item) => item.weight).reduce(
  (acc, cur) => (acc += cur),
  0
);

function PreviewLoader() {
  const { projectState, project } = useProject();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (projectState.startupMessage === StartupMessage.Restarting) {
      setProgress(100);
    } else {
      const currentIndex = StartupStageWeight.findIndex(
        (item) => item.StartupMessage === projectState.startupMessage
      );
      const currentWeight = StartupStageWeight[currentIndex].weight;
      const startupStageWeightSumUntillNow = StartupStageWeight.slice(0, currentIndex)
        .map((item) => item.weight)
        .reduce((acc, cur) => (acc += cur), 0);

      let progressComponent = 0;

      if (projectState.stageProgress !== undefined) {
        let progressComponent = projectState.stageProgress;
      }
      setProgress(
        ((startupStageWeightSumUntillNow + progressComponent * currentWeight) /
          startupStageWeightSum) *
          100
      );
    }
  }, [projectState]);

  return (
    <>
      <div className="preview-loader-container">
        {projectState.startupMessage === StartupMessage.Building && (
          <div className="preview-loader-button-group">
            <IconButton
              onClick={() => project.focusBuildOutput()}
              tooltip={{
                label: "Open build logs",
                side: "top",
              }}>
              <span className="codicon codicon-symbol-keyword" />
            </IconButton>
          </div>
        )}

        <div className="preview-loader-button-group">
          <StartupMessageComponent className="preview-loader-message">
            {projectState.startupMessage}
          </StartupMessageComponent>
          {projectState.stageProgress !== undefined && (
            <div className="preview-loader-stage-progress">
              {(projectState.stageProgress * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
      <ProgressBar progress={progress} />
    </>
  );
}

export default PreviewLoader;
