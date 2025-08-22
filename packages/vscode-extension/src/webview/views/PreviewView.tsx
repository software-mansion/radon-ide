import { useState, useEffect, useCallback } from "react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import { use$ } from "@legendapp/state/react";
import Preview from "../components/Preview";
import IconButton from "../components/shared/IconButton";
import UrlBar from "../components/UrlBar";
import SettingsDropdown from "../components/SettingsDropdown";
import NoDeviceView from "./NoDeviceView";
import DeviceSettingsDropdown from "../components/DeviceSettingsDropdown";
import DeviceSettingsIcon from "../components/icons/DeviceSettingsIcon";
import { useProject } from "../providers/ProjectProvider";
import DeviceSelect from "../components/DeviceSelect";
import { InspectDataMenu } from "../components/InspectDataMenu";
import {
  Frame,
  InspectDataStackItem,
  InspectorAvailabilityStatus,
  InspectStackData,
  ProfilingState,
} from "../../common/Project";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/deviceConstants";
import "./View.css";
import "./PreviewView.css";
import ReplayIcon from "../components/icons/ReplayIcon";
import RecordingIcon from "../components/icons/RecordingIcon";
import ToolsDropdown from "../components/ToolsDropdown";
import AppRootSelect from "../components/AppRootSelect";
import { vscode } from "../utilities/vscode";
import RadonConnectView from "./RadonConnectView";
import { useStore } from "../providers/storeProvider";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";
import { ZoomLevelType } from "../../common/State";

const INSPECTOR_AVAILABILITY_MESSAGES = {
  [InspectorAvailabilityStatus.Available]: "Select an element to inspect it",
  [InspectorAvailabilityStatus.UnavailableEdgeToEdge]:
    "Element Inspector is disabled in apps that don't support Edge-to-Edge",
  [InspectorAvailabilityStatus.UnavailableInactive]:
    "Element Inspector is disabled when the app is inactive",
} as const;

type ActiveToolState = ProfilingState;

function ActiveToolButton({
  toolState,
  title,
  onClick,
}: {
  toolState: ActiveToolState;
  title: string;
  onClick: () => void;
}) {
  const showButton = toolState !== "stopped";
  return (
    <IconButton
      className={showButton ? "button-recording-on" : "button-recording-off"}
      tooltip={{
        label: title,
      }}
      disabled={toolState !== "profiling"}
      onClick={onClick}>
      {showButton && (
        <>
          <span
            className={
              toolState === "saving"
                ? "codicon codicon-loading codicon-modifier-spin"
                : "recording-rec-dot"
            }
          />
          <span>{title}</span>
        </>
      )}
    </IconButton>
  );
}

function PreviewView() {
  const store$ = useStore();
  const rotation = use$(store$.workspaceConfiguration.deviceRotation);

  const { selectedDeviceSession, projectState, project, deviceSettings } = useProject();

  const selectedDeviceSessionState = useSelectedDeviceSessionState();

  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectFrame, setInspectFrame] = useState<Frame | null>(null);
  const [inspectStackData, setInspectStackData] = useState<InspectStackData | null>(null);

  const zoomLevel = use$(store$.projectState.previewZoom);
  const onZoomChanged = useCallback(
    (zoom: ZoomLevelType) => {
      store$.projectState.previewZoom.set(zoom);
    },
    [project]
  );

  const devices = use$(store$.devicesState.devices) ?? [];

  const frameReportingEnabled = use$(useSelectedDeviceSessionState().frameReporting.enabled);
  const fps = use$(useSelectedDeviceSessionState().frameReporting.frameReport.fps);

  const initialized = use$(store$.projectState.initialized);

  const radonConnectEnabled = projectState.connectState.enabled;
  const radonConnectConnected = projectState.connectState.connected;
  const selectedDevice = selectedDeviceSession?.deviceInfo;
  const hasNoDevices = projectState !== undefined && devices.length === 0;
  const isStarting = selectedDeviceSession?.status === "starting";
  const isRunning = selectedDeviceSession?.status === "running";

  const isRecording = use$(selectedDeviceSessionState.screenCapture.isRecording);
  const recordingTime = use$(selectedDeviceSessionState.screenCapture.recordingTime);
  const replayData = use$(selectedDeviceSessionState.screenCapture.replayData);

  const inspectorAvailabilityStatus = isRunning
    ? selectedDeviceSession.elementInspectorAvailability
    : InspectorAvailabilityStatus.Available;

  const navBarButtonsActive = initialized && !isStarting && !radonConnectEnabled;
  const inspectorAvailable =
    navBarButtonsActive &&
    isRunning &&
    inspectorAvailabilityStatus === InspectorAvailabilityStatus.Available;
  const debuggerToolsButtonsActive = navBarButtonsActive; // this stays in sync with navBarButtonsActive, but we will enable it for radon connect later

  const deviceProperties = iOSSupportedDevices.concat(AndroidSupportedDevices).find((sd) => {
    return sd.modelId === selectedDeviceSession?.deviceInfo.modelId;
  });

  useEffect(() => {
    resetInspector();
  }, [rotation]);

  useEffect(() => {
    setIsInspecting(false);
    setInspectFrame(null);
    setInspectStackData(null);
  }, [inspectorAvailable]);

  useEffect(() => {
    const disableInspectorOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsInspecting(false);
      }
    };
    document.addEventListener("keydown", disableInspectorOnEscape, false);

    return () => {
      document.removeEventListener("keydown", disableInspectorOnEscape, false);
    };
  }, []);

  function toggleRecording() {
    try {
      project.toggleRecording();
    } catch (e) {
      if (isRecording) {
        project.showDismissableError("Failed to capture recording");
      }
    }
  }

  function stopProfilingCPU() {
    project.stopProfilingCPU();
  }

  function stopProfilingReact() {
    project.stopProfilingReact();
  }

  function stopReportingFrameRate() {
    project.stopReportingFrameRate();
  }

  async function handleReplay() {
    try {
      await project.captureReplay();
    } catch (e) {
      project.showDismissableError("Failed to capture replay");
    }
  }

  async function captureScreenshot() {
    project.captureScreenshot();
  }

  function onInspectorItemSelected(item: InspectDataStackItem) {
    project.openFileAt(item.source.fileName, item.source.line0Based, item.source.column0Based);
  }

  function resetInspector() {
    setInspectFrame(null);
    setInspectStackData(null);
  }

  const showReplayButton = deviceSettings.replaysEnabled && !isRecording;

  const recordingTimeFormat = `${Math.floor(recordingTime / 60)}:${(recordingTime % 60)
    .toString()
    .padStart(2, "0")}`;

  let content = null;
  if (radonConnectEnabled) {
    content = <RadonConnectView />;
  } else if (!initialized) {
    content = (
      <div className="preview-content-placeholder">
        <VscodeProgressRing />
      </div>
    );
  } else if (selectedDevice) {
    content = (
      <Preview
        key={selectedDevice.id}
        isInspecting={isInspecting}
        setIsInspecting={setIsInspecting}
        inspectFrame={inspectFrame}
        setInspectFrame={setInspectFrame}
        setInspectStackData={setInspectStackData}
        onInspectorItemSelected={onInspectorItemSelected}
        zoomLevel={zoomLevel}
        replayData={replayData}
        onReplayClose={() => selectedDeviceSessionState.screenCapture.replayData.set(null)}
        onZoomChanged={onZoomChanged}
      />
    );
  } else {
    content = <NoDeviceView hasNoDevices={hasNoDevices} />;
  }

  const logCounter = isRunning ? selectedDeviceSession.logCounter : 0;
  const profilingCPUState = isRunning ? selectedDeviceSession?.profilingCPUState : "stopped";
  const profilingReactState = isRunning ? selectedDeviceSession?.profilingReactState : "stopped";

  return (
    <div
      className="panel-view"
      data-test="radon-panel-view"
      onFocus={(e) => {
        vscode.postMessage({
          command: "focusPreview",
        });
      }}
      onBlur={(e) => {
        vscode.postMessage({
          command: "blurPreview",
        });
      }}>
      <div className="button-group-top">
        <div className="button-group-top-left">
          <UrlBar disabled={!selectedDeviceSession} />
        </div>
        <div className="button-group-top-right">
          <ActiveToolButton
            toolState={profilingCPUState}
            title="Stop profiling CPU"
            onClick={stopProfilingCPU}
          />
          <ActiveToolButton
            toolState={profilingReactState}
            title="Stop profiling React"
            onClick={stopProfilingReact}
          />
          <ActiveToolButton
            toolState={frameReportingEnabled ? "profiling" : "stopped"}
            title={"FPS: " + (fps ?? 0)}
            onClick={stopReportingFrameRate}
          />
          <ToolsDropdown disabled={!debuggerToolsButtonsActive}>
            <IconButton
              tooltip={{ label: "Tools", type: "primary" }}
              dataTest="radon-top-bar-tools-dropdown-trigger">
              <span className="codicon codicon-tools" />
            </IconButton>
          </ToolsDropdown>
          <IconButton
            className={isRecording ? "button-recording-on" : ""}
            tooltip={{
              label: isRecording ? "Stop screen recording" : "Start screen recording",
            }}
            onClick={toggleRecording}
            disabled={!navBarButtonsActive}>
            {isRecording ? (
              <div className="recording-rec-indicator">
                <div className="recording-rec-dot" />
                <span>{recordingTimeFormat}</span>
              </div>
            ) : (
              <RecordingIcon />
            )}
          </IconButton>
          {showReplayButton && (
            <IconButton
              tooltip={{
                label: "Replay the last few seconds of the app",
              }}
              onClick={handleReplay}
              disabled={!navBarButtonsActive}>
              <ReplayIcon />
            </IconButton>
          )}
          <IconButton
            tooltip={{
              label: "Capture a screenshot of the app",
            }}
            onClick={captureScreenshot}
            disabled={!navBarButtonsActive}>
            <span slot="start" className="codicon codicon-device-camera" />
          </IconButton>
          <IconButton
            counter={logCounter}
            counterMode="compact"
            onClick={() => project.focusDebugConsole()}
            tooltip={{
              label: "Open logs panel",
            }}
            disabled={!debuggerToolsButtonsActive}>
            <span slot="start" className="codicon codicon-debug-console" />
          </IconButton>
          <SettingsDropdown project={project} isDeviceRunning={isRunning || radonConnectConnected}>
            <IconButton
              tooltip={{ label: "Settings", type: "primary" }}
              dataTest="radon-top-bar-settings-dropdown-trigger">
              <span className="codicon codicon-settings-gear" />
            </IconButton>
          </SettingsDropdown>
        </div>
      </div>

      {content}

      {!replayData && inspectStackData && (
        <InspectDataMenu
          inspectLocation={inspectStackData.requestLocation}
          inspectStack={inspectStackData.stack}
          device={deviceProperties}
          frame={inspectFrame}
          onSelected={onInspectorItemSelected}
          onHover={(item) => {
            if (item.frame) {
              setInspectFrame(item.frame);
            }
          }}
          onCancel={() => resetInspector()}
        />
      )}

      <div className="button-group-bottom">
        <IconButton
          shouldDisplayLabelWhileDisabled={navBarButtonsActive}
          active={isInspecting}
          tooltip={{
            label: INSPECTOR_AVAILABILITY_MESSAGES[inspectorAvailabilityStatus],
          }}
          onClick={() => {
            project.sendTelemetry("inspector:button-clicked", {
              isInspecting: String(!isInspecting),
            });
            setIsInspecting(!isInspecting);
          }}
          disabled={!inspectorAvailable}>
          <span className="codicon codicon-inspect" />
        </IconButton>

        <span className="group-separator" />
        <div className="app-device-group">
          {!radonConnectEnabled && (
            <>
              <AppRootSelect />
              <span className="codicon codicon-chevron-right" />
            </>
          )}
          <DeviceSelect />
        </div>
        <div className="spacer" />
        <DeviceSettingsDropdown disabled={!navBarButtonsActive}>
          <IconButton
            tooltip={{ label: "Device settings", type: "primary" }}
            dataTest="radon-bottom-bar-device-settings-dropdown-trigger">
            <DeviceSettingsIcon />
          </IconButton>
        </DeviceSettingsDropdown>
      </div>
    </div>
  );
}

export default PreviewView;
