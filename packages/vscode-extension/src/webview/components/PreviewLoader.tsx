import classNames from "classnames";
import { useEffect, useState } from "react";

import "./PreviewLoader.css";

import StartupMessageComponent from "./shared/StartupMessage";
import ProgressBar from "./shared/ProgressBar";

import {
  DeviceSessionStateStarting,
  DeviceRotation,
  StartupMessage,
  StartupStageWeight,
} from "../../common/Project";
import { useProject } from "../providers/ProjectProvider";
import Button from "./shared/Button";
import { useDevices } from "../providers/DevicesProvider";
import { Output } from "../../common/OutputChannel";
import { DevicePlatform } from "../../common/DeviceManager";
import { useStore } from "../providers/storeProvider";
import { use$ } from "@legendapp/state/react";

const startupStageWeightSum = StartupStageWeight.map((item) => item.weight).reduce(
  (acc, cur) => acc + cur,
  0
);

const TOOLTIPS = {
  logs: { label: "Open Radon IDE Logs", side: "top" },
  preview: { label: "Force show device screen", side: "top" },
  troubleshoot: { label: "Visit troubleshoot guide", side: "top" },
  rebuild: { label: "Clean rebuild project", side: "top" },
} as const;

function PreviewLoader({
  startingSessionState,
  onRequestShowPreview,
}: {
  onRequestShowPreview: () => void;
  startingSessionState: DeviceSessionStateStarting;
}) {
  const store$ = useStore();
  const rotation = use$(store$.workspaceConfiguration.deviceRotation);

  const { project, selectedDeviceSession } = useProject();
  const { deviceSessionsManager } = useDevices();
  const [progress, setProgress] = useState(0);
  const platform = selectedDeviceSession?.deviceInfo.platform;

  const [isLoadingSlowly, setIsLoadingSlowly] = useState(false);

  const startupMessage = startingSessionState.startupMessage;
  const stageProgress = startingSessionState.stageProgress;

  const isLandscape =
    rotation === DeviceRotation.LandscapeLeft || rotation === DeviceRotation.LandscapeRight;

  const isWaitingForApp = startupMessage === StartupMessage.WaitingForAppToLoad;
  const isBuilding = startupMessage === StartupMessage.Building;

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

  return (
    <div className={`preview-loader-wrapper ${isLandscape ? "landscape" : "portrait"}`}>
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
            tooltip={TOOLTIPS.logs}>
            <span className="codicon codicon-output" />{" "}
            <span className="button-text">{TOOLTIPS.logs.label}</span>
          </Button>
          <Button type="secondary" onClick={onRequestShowPreview} tooltip={TOOLTIPS.preview}>
            <span className="codicon codicon-open-preview" />{" "}
            <span className="button-text">{TOOLTIPS.preview.label}</span>
          </Button>
          <a href="https://ide.swmansion.com/docs/guides/troubleshooting" target="_blank">
            <Button type="secondary" tooltip={TOOLTIPS.troubleshoot}>
              <span className="codicon codicon-browser" />{" "}
              <span className="button-text">{TOOLTIPS.troubleshoot.label}</span>
            </Button>
          </a>
          <Button
            type="secondary"
            onClick={() => deviceSessionsManager.reloadCurrentSession("rebuild")}
            tooltip={TOOLTIPS.rebuild}>
            <span className="codicon codicon-refresh" />{" "}
            <span className="button-text">{TOOLTIPS.rebuild.label}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default PreviewLoader;
