import { useState, useEffect, useCallback } from "react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import { use$ } from "@legendapp/state/react";
import Preview from "../components/Preview";
import IconButton from "../components/shared/IconButton";
import UrlBar from "../components/UrlBar";
import SettingsDropdown from "../components/SettingsDropdown";
import { useModal } from "../providers/ModalProvider";
import NoDeviceView from "./NoDeviceView";
import DeviceSettingsDropdown from "../components/DeviceSettingsDropdown";
import DeviceSettingsIcon from "../components/icons/DeviceSettingsIcon";
import { Platform, useProject } from "../providers/ProjectProvider";
import DeviceSelect from "../components/DeviceSelect";
import { InspectDataMenu } from "../components/InspectDataMenu";
import Button from "../components/shared/Button";
import {
  Frame,
  InspectDataStackItem,
  InspectorAvailabilityStatus,
  InspectStackData,
  ProfilingState,
  ZoomLevelType,
} from "../../common/Project";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/deviceConstants";
import "./View.css";
import "./PreviewView.css";
import ReplayIcon from "../components/icons/ReplayIcon";
import RecordingIcon from "../components/icons/RecordingIcon";
import { ActivateLicenseView } from "./ActivateLicenseView";
import ToolsDropdown from "../components/ToolsDropdown";
import AppRootSelect from "../components/AppRootSelect";
import { vscode } from "../utilities/vscode";
import RadonConnectView from "./RadonConnectView";
import { useStore } from "../providers/storeProvider";

const INSPECTOR_AVAILABILITY_MESSAGES = {
  [InspectorAvailabilityStatus.Available]: "Select an element to inspect it",
  [InspectorAvailabilityStatus.UnavailableEdgeToEdge]:
    "Element Inspector is disabled in apps that don't support Edge-to-Edge",
  [InspectorAvailabilityStatus.UnavailableInactive]:
    "Element Inspector is disabled when the app is inactive",
} as const;

function ActivateLicenseButton() {
  const { openModal } = useModal();
  const { project } = useProject();
  return (
    <Button
      className="activate-license-button"
      dataTest="activate-license-button"
      onClick={() => {
        project.sendTelemetry("activateLicenseButtonClicked");
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
  const store$ = useStore();
  const rotation = use$(store$.workspaceConfiguration.deviceRotation);

  const {
    selectedDeviceSession,
    projectState,
    project,
    deviceSettings,
    hasActiveLicense,
    replayData,
    setReplayData,
  } = useProject();

  const [isInspecting, setIsInspecting] = useState(false);
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

  const devices = use$(store$.devicesState.devices) ?? [];

  const initialized = projectState.initialized;
  const radonConnectEnabled = projectState.connectState.enabled;
  const radonConnectConnected = projectState.connectState.connected;
  const selectedDevice = selectedDeviceSession?.deviceInfo;
  const hasNoDevices = projectState !== undefined && devices.length === 0;
  const isStarting = selectedDeviceSession?.status === "starting";
  const isRunning = selectedDeviceSession?.status === "running";
  const isRecording = selectedDeviceSession?.isRecordingScreen ?? false;
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
      project.showDismissableError("Failed to capture recording");
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
        onReplayClose={() => setReplayData(undefined)}
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
          <ProfilingButton
            profilingState={profilingCPUState}
            title="Stop profiling CPU"
            onClick={stopProfilingCPU}
          />
          <ProfilingButton
            profilingState={profilingReactState}
            title="Stop profiling React"
            onClick={stopProfilingReact}
          />
          <ToolsDropdown disabled={!debuggerToolsButtonsActive}>
            <IconButton tooltip={{ label: "Tools", type: "primary" }} dataTest="radon-tools-button">
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
              dataTest="radon-settings-button">
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
        {Platform.OS === "macos" && !hasActiveLicense && <ActivateLicenseButton />}
        <DeviceSettingsDropdown disabled={!navBarButtonsActive}>
          <IconButton
            tooltip={{ label: "Device settings", type: "primary" }}
            dataTest="device-settings-button">
            <DeviceSettingsIcon />
          </IconButton>
        </DeviceSettingsDropdown>
      </div>
    </div>
  );
}

export default PreviewView;
