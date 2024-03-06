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

      setProgress(
        ((startupStageWeightSumUntillNow + projectState.stageProgress * currentWeight) /
          startupStageWeightSum) *
          100
      );
    }
  }, [projectState]);

  return (
    <>
      <div className="preview-loader-container">
        <div className="preview-loader-button-group">
          <IconButton
            onClick={() => project.focusBuildOutput()}
            tooltip={{
              label: "Open build logs",
              side: "top",
            }}>
            <span className="codicon codicon-symbol-keyword" />
          </IconButton>
          <div className="preview-loader-spacer" />
          <div className="preview-loader-stage-progress">
            {Boolean(projectState.stageProgress) &&
              `${(projectState.stageProgress * 100).toFixed(1)}%`}
          </div>
        </div>
        <StartupMessageComponent className="preview-loader-message">
          {projectState.startupMessage}
        </StartupMessageComponent>
      </div>
      <ProgressBar progress={progress} />
    </>
  );
}

export default PreviewLoader;
