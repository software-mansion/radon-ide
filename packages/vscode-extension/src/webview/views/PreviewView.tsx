import { useState, useEffect, useCallback } from "react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import Preview from "../components/Preview";
import IconButton from "../components/shared/IconButton";
import UrlBar from "../components/UrlBar";
import SettingsDropdown from "../components/SettingsDropdown";
import { useModal } from "../providers/ModalProvider";
import NoDeviceView from "./NoDeviceView";
import DeviceSettingsDropdown from "../components/DeviceSettingsDropdown";
import DeviceSettingsIcon from "../components/icons/DeviceSettingsIcon";
import { useDevices } from "../providers/DevicesProvider";
import { useProject } from "../providers/ProjectProvider";
import DeviceSelect from "../components/DeviceSelect";
import { InspectDataMenu } from "../components/InspectDataMenu";
import Button from "../components/shared/Button";
import {
  Frame,
  InspectDataStackItem,
  InspectStackData,
  ProfilingState,
  InspectorState,
  ZoomLevelType,
} from "../../common/Project";
import { Platform, useUtils } from "../providers/UtilsProvider";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/deviceContants";
import "./View.css";
import "./PreviewView.css";
import ReplayIcon from "../components/icons/ReplayIcon";
import RecordingIcon from "../components/icons/RecordingIcon";
import { ActivateLicenseView } from "./ActivateLicenseView";
import ToolsDropdown from "../components/ToolsDropdown";
import AppRootSelect from "../components/AppRootSelect";

function ActivateLicenseButton() {
  const { openModal } = useModal();
  const { sendTelemetry } = useUtils();
  return (
    <Button
      className="activate-license-button"
      onClick={() => {
        sendTelemetry("activateLicenseButtonClicked");
        openModal("Activate License", <ActivateLicenseView />);
      }}>
      {""} {/* using empty string here as the content is controlled via css */}
    </Button>
  );
}

function ProfilingButton({
  profilingState,
  title,
  onClick,
}: {
  profilingState: ProfilingState;
  title: string;
  onClick: () => void;
}) {
  const showButton = profilingState !== "stopped";
  return (
    <IconButton
      className={showButton ? "button-recording-on button-recording" : "button-recording"}
      tooltip={{
        label: title,
      }}
      disabled={profilingState !== "profiling"}
      onClick={onClick}>
      {showButton && (
        <>
          <span
            className={
              profilingState === "saving"
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
  const { projectState, project, deviceSettings, hasActiveLicense, replayData, setReplayData } =
    useProject();
  const { showDismissableError } = useUtils();

  // The inspector can be in one of the following states:
  // "disabled" - inspector is not active
  // "inspecting" - inspector is active and inspecting an element
  // "selected" - inspector is active with an element selected
  const [inspectorState, setInspectorState] = useState<InspectorState>("disabled");
  const [inspectFrame, setInspectFrame] = useState<Frame | null>(null);
  const [inspectStackData, setInspectStackData] = useState<InspectStackData | null>(null);
  const zoomLevel = projectState.previewZoom ?? "Fit";
  const onZoomChanged = useCallback(
    (zoom: ZoomLevelType) => {
      project.updatePreviewZoomLevel(zoom);
    },
    [project]
  );
  const [recordingTime, setRecordingTime] = useState(0);
  const { devices } = useDevices();

  const initialized = projectState.initialized;
  const selectedDevice = projectState.selectedDevice;
  const hasNoDevices = projectState !== undefined && devices.length === 0;
  const isStarting = projectState.status === "starting";
  const isRunning = projectState.status === "running";
  const isRecording = projectState.isRecordingScreen;

  const deviceProperties = iOSSupportedDevices.concat(AndroidSupportedDevices).find((sd) => {
    return sd.modelId === projectState?.selectedDevice?.modelId;
  });

  const { openFileAt } = useUtils();

  useEffect(() => {
    const disableInspectorOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInspectorState("disabled");
      }
    };
    document.addEventListener("keydown", disableInspectorOnEscape, false);

    return () => {
      document.removeEventListener("keydown", disableInspectorOnEscape, false);
    };
  }, []);

  useEffect(() => {
    if (inspectorState === "disabled") {
      resetInspector();
    }
  }, [inspectorState]);

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setRecordingTime((prevRecordingTime) => prevRecordingTime + 1);
      }, 1000);
      return () => {
        setRecordingTime(0);
        clearInterval(interval);
      };
    }
  }, [isRecording]);

  function startRecording() {
    project.startRecording();
  }

  async function stopRecording() {
    try {
      project.captureAndStopRecording();
    } catch (e) {
      showDismissableError("Failed to capture recording");
    }
  }

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function stopProfilingCPU() {
    project.stopProfilingCPU();
  }

  function stopProfilingReact() {
    project.stopProfilingReact();
  }

  async function handleReplay() {
    try {
      await project.captureReplay();
    } catch (e) {
      showDismissableError("Failed to capture replay");
    }
  }

  async function captureScreenshot() {
    project.captureScreenshot();
  }

  function onInspectorItemSelected(item: InspectDataStackItem) {
    openFileAt(item.source.fileName, item.source.line0Based, item.source.column0Based);
  }

  function resetInspector() {
    setInspectorState("disabled");
    setInspectFrame(null);
    setInspectStackData(null);
  }

  const showReplayButton = deviceSettings.replaysEnabled && !isRecording;

  const recordingTimeFormat = `${Math.floor(recordingTime / 60)}:${(recordingTime % 60)
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="panel-view">
      <div className="button-group-top">
        <div className="button-group-top-left">
          <UrlBar disabled={hasNoDevices} />
        </div>
        <div className="button-group-top-right">
          <ProfilingButton
            profilingState={projectState.profilingCPUState}
            title="Stop profiling CPU"
            onClick={stopProfilingCPU}
          />
          <ProfilingButton
            profilingState={projectState.profilingReactState}
            title="Stop profiling React"
            onClick={stopProfilingReact}
          />
          <ToolsDropdown disabled={hasNoDevices || !isRunning}>
            <IconButton tooltip={{ label: "Tools", type: "primary" }}>
              <span className="codicon codicon-tools" />
            </IconButton>
          </ToolsDropdown>
          <IconButton
            className={isRecording ? "button-recording-on" : ""}
            tooltip={{
              label: isRecording ? "Stop screen recording" : "Start screen recording",
            }}
            onClick={toggleRecording}
            disabled={isStarting}>
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
              disabled={isStarting}>
              <ReplayIcon />
            </IconButton>
          )}
          <IconButton
            tooltip={{
              label: "Capture a screenshot of the app",
            }}
            onClick={captureScreenshot}
            disabled={isStarting}>
            <span slot="start" className="codicon codicon-device-camera" />
          </IconButton>
          <IconButton
            counter={projectState.logCounter}
            onClick={() => project.focusDebugConsole()}
            tooltip={{
              label: "Open logs panel",
            }}
            disabled={hasNoDevices}>
            <span slot="start" className="codicon codicon-debug-console" />
          </IconButton>
          <SettingsDropdown project={project} isDeviceRunning={isRunning} disabled={hasNoDevices}>
            <IconButton tooltip={{ label: "Settings", type: "primary" }}>
              <span className="codicon codicon-settings-gear" />
            </IconButton>
          </SettingsDropdown>
        </div>
      </div>

      {selectedDevice && initialized ? (
        <Preview
          key={selectedDevice.id}
          inspectorState={inspectorState}
          setInspectorState={setInspectorState}
          inspectFrame={inspectFrame}
          setInspectFrame={setInspectFrame}
          setInspectStackData={setInspectStackData}
          onInspectorItemSelected={onInspectorItemSelected}
          zoomLevel={zoomLevel}
          replayData={replayData}
          onReplayClose={() => setReplayData(undefined)}
          onZoomChanged={onZoomChanged}
        />
      ) : (
        <div className="missing-device-filler">
          {initialized ? <NoDeviceView hasNoDevices={hasNoDevices} /> : <VscodeProgressRing />}
        </div>
      )}

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
          onCancel={() => {
            setInspectorState("disabled");
          }}
        />
      )}

      <div className="button-group-bottom">
        <IconButton
          active={inspectorState !== "disabled"}
          tooltip={{
            label: "Select an element to inspect it",
          }}
          onClick={() => {
            switch (inspectorState) {
              case "disabled":
                setInspectorState("inspecting");
                break;
              case "inspecting":
                setInspectorState("disabled");
                break;
              case "selected":
                setInspectorState("disabled");
                break;
            }
          }}
          disabled={hasNoDevices}>
          <span className="codicon codicon-inspect" />
        </IconButton>

        <span className="group-separator" />

        <div className="app-device-group">
          <AppRootSelect />
          <span className="codicon codicon-chevron-right" />
          <DeviceSelect />
        </div>

        <div className="spacer" />
        {Platform.OS === "macos" && !hasActiveLicense && <ActivateLicenseButton />}
        <DeviceSettingsDropdown disabled={hasNoDevices || !isRunning}>
          <IconButton tooltip={{ label: "Device settings", type: "primary" }}>
            <DeviceSettingsIcon
              color={
                hasNoDevices || !isRunning ? "var(--swm-disabled-text)" : "var(--swm-default-text)"
              }
            />
          </IconButton>
        </DeviceSettingsDropdown>
      </div>
    </div>
  );
}

export default PreviewView;
