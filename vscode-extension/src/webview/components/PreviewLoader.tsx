import { useEffect, useState } from "react";

import StartupMessageComponent from "./shared/StartupMessage";
import ProgressBar from "./shared/ProgressBar";

import { StartupMessage } from "../../common/Project";

interface PreviewLoaderProps {
  startupMessage: string;
}

const startupMessageArr = Object.values(StartupMessage).filter(
  (message) => message !== StartupMessage.Restarting
);

function PreviewLoader({ startupMessage }: PreviewLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (startupMessage === StartupMessage.Restarting) {
      setProgress(100);
    } else {
      setProgress(
        (startupMessageArr.indexOf(startupMessage as StartupMessage) /
          (startupMessageArr.length - 1)) *
          100
      );
    }
  }, [startupMessage]);

  return (
    <>
      <StartupMessageComponent>{startupMessage}</StartupMessageComponent>
      <ProgressBar progress={progress} />
    </>
  );
}

export default PreviewLoader;
