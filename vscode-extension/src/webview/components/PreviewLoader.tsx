import { useEffect, useState } from "react";

import StartupMessageComponent from "./shared/StartupMessage";
import ProgressBar from "./shared/ProgressBar";

import { StartupMessage } from "../../common/Project";
import { useProject } from "../providers/ProjectProvider";
import IconButton from "./shared/IconButton";


const startupMessageArr = Object.values(StartupMessage).filter(
  (message) => message !== StartupMessage.Restarting
);

function PreviewLoader() {
  const { projectState, project } = useProject();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (projectState?.startupMessage === StartupMessage.Restarting) {
      setProgress(100);
    } else {
      setProgress(
        (startupMessageArr.indexOf(projectState?.startupMessage as StartupMessage) /
          (startupMessageArr.length - 1)) *
        100
      );
    }
  }, [projectState?.startupMessage]);

  return (
    <>
      <StartupMessageComponent>{projectState?.startupMessage}</StartupMessageComponent>
      <ProgressBar progress={progress} />
      {projectState?.startupMessage === StartupMessage.Building &&
        <IconButton
          onClick={() => project.focusBuildOutput()}
          tooltip={{
            label: "Show build logs",
            side: "bottom",
          }}>
          <span className="codicon codicon-symbol-keyword" />
        </IconButton>
      }

    </>
  );
}

export default PreviewLoader;
