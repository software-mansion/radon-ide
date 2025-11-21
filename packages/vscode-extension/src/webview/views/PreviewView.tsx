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
import { Platform, useProject } from "../providers/ProjectProvider";
import DeviceSelect from "../components/DeviceSelect";
import { InspectDataMenu } from "../components/InspectDataMenu";
import { Frame, InspectDataStackItem, InspectStackData } from "../../common/Project";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/deviceConstants";
import "./View.css";
import "./PreviewView.css";
import ReplayIcon from "../components/icons/ReplayIcon";
import RecordingIcon from "../components/icons/RecordingIcon";
import ToolsDropdown from "../components/ToolsDropdown";
import AppRootSelect from "../components/AppRootSelect";
import RadonConnectView from "./RadonConnectView";
import { useStore } from "../providers/storeProvider";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";
import {
  InspectorAvailabilityStatus,
  MaestroTestState,
  ProfilingState,
  ZoomLevelType,
} from "../../common/State";
import { useModal } from "../providers/ModalProvider";
import Button from "../components/shared/Button";
import { ActivateLicenseView } from "./ActivateLicenseView";
import { Feature, LicenseStatus } from "../../common/License";
import { usePaywalledCallback } from "../hooks/usePaywalledCallback";
import { useDevices } from "../hooks/useDevices";

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
      dataTest="open-activate-license-modal-button"
      onClick={() => {
        project.sendTelemetry("activateLicenseButtonClicked");
        openModal(<ActivateLicenseView />, { title: "Activate License" });
      }}>
      {""} {/* using empty string here as the content is controlled via css */}
    </Button>
  );
}

type ActiveToolState = ProfilingState;

function ActiveToolButton({
  toolState,
  title,
  onClick,
  dataTest,
}: {
  toolState: ActiveToolState;
  title: string;
  onClick: () => void;
  dataTest?: string;
}) {
  const showButton = toolState !== "stopped";
  return (
    <IconButton
      className={showButton ? "button-recording-on" : "button-recording-off"}
      data-testid={dataTest}
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

function ActiveTestButton({
  testState,
  title,
  onClick,
  dataTest,
}: {
  testState: MaestroTestState;
  title: string;
  onClick: () => void;
  dataTest?: string;
}) {
  const showButton = testState !== "stopped";
  return (
    <IconButton
      className={showButton ? "button-recording-on" : "button-recording-off"}
      data-testid={dataTest}
      tooltip={{
        label: title,
      }}
      disabled={testState !== "running"}
      onClick={onClick}>
      {showButton && (
        <>
          <span
            className={
              testState === "aborting"
                ? "codicon codicon-loading codicon-modifier-spin"
                : "stop-square"
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
  const selectedDeviceSessionState = useSelectedDeviceSessionState();
  const selectedDeviceSessionStatus = use$(selectedDeviceSessionState.status);
  const selectedProjectDevice = use$(selectedDeviceSessionState.deviceInfo);
  const deviceSettings = use$(store$.workspaceConfiguration.deviceSettings);
  const licenseStatus = use$(store$.license.status);

  const { projectState, project } = useProject();

  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectFrame, setInspectFrame] = useState<Frame | null>(null);
  const [inspectStackData, setInspectStackData] = useState<InspectStackData | null>(null);

  const devices = useDevices(store$);
  const fps = use$(useSelectedDeviceSessionState().frameReporting.frameReport.fps);
  const frameReportingEnabled = use$(useSelectedDeviceSessionState().frameReporting.enabled);
  const initialized = use$(store$.projectState.initialized);
  const radonConnectConnected = projectState.connectState.connected;
  const radonConnectEnabled = projectState.connectState.enabled;
  const rotation = use$(store$.workspaceConfiguration.deviceSettings.deviceRotation);
  const zoomLevel = use$(store$.projectState.previewZoom);
  const onZoomChanged = useCallback(
    (zoom: ZoomLevelType) => {
      store$.projectState.previewZoom.set(zoom);
    },
    [project]
  );

  const hasNoDevices = projectState !== undefined && devices.length === 0;
  const isStarting = selectedDeviceSessionStatus === "starting";
  const isRunning = selectedDeviceSessionStatus === "running";

  const isRecording = use$(selectedDeviceSessionState.screenCapture.isRecording);
  const modelId = use$(selectedDeviceSessionState.deviceInfo.modelId);
  const recordingTime = use$(selectedDeviceSessionState.screenCapture.recordingTime) ?? 0;
  const replayData = use$(selectedDeviceSessionState.screenCapture.replayData);
  const selectedDevice = use$(selectedDeviceSessionState.deviceInfo);

  const elementInspectorAvailability =
    use$(selectedDeviceSessionState.applicationSession.elementInspectorAvailability) ??
    InspectorAvailabilityStatus.Available;

  const inspectorAvailabilityStatus = isRunning
    ? elementInspectorAvailability
    : InspectorAvailabilityStatus.Available;

  const navBarButtonsActive = initialized && !isStarting && !radonConnectEnabled;
  const inspectorAvailable =
    navBarButtonsActive &&
    isRunning &&
    inspectorAvailabilityStatus === InspectorAvailabilityStatus.Available;
  const debuggerToolsButtonsActive = navBarButtonsActive; // this stays in sync with navBarButtonsActive, but we will enable it for radon connect later

  const deviceProperties = iOSSupportedDevices.concat(AndroidSupportedDevices).find((sd) => {
    return sd.modelId === modelId;
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

  const paywalledToggleRecording = usePaywalledCallback(
    async () => {
      await project.toggleRecording();
    },
    Feature.ScreenRecording,
    []
  );

  function toggleRecording() {
    try {
      paywalledToggleRecording();
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

  function stopMaestroTest() {
    project.stopMaestroTest();
  }

  const paywalledCaptureReplay = usePaywalledCallback(
    async () => {
      await project.captureReplay();
    },
    Feature.ScreenReplay,
    []
  );

  async function handleReplay() {
    try {
      await paywalledCaptureReplay();
    } catch (e) {
      project.showDismissableError("Failed to capture replay");
    }
  }

  const paywalledCaptureScreenshot = usePaywalledCallback(
    async () => {
      await project.captureScreenshot();
    },
    Feature.Screenshot,
    []
  );

  async function captureScreenshot() {
    try {
      await paywalledCaptureScreenshot();
    } catch (e) {
      project.showDismissableError("Failed to capture screenshot");
    }
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
        <VscodeProgressRing data-testid="vscode-progress-ring" />
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

  const logCounter = use$(isRunning ? selectedDeviceSessionState.applicationSession.logCounter : 0);
  const profilingCPUState = use$(() =>
    isRunning
      ? (selectedDeviceSessionState.applicationSession.profilingCPUState.get() ?? "stopped")
      : "stopped"
  );
  const profilingReactState = use$(() =>
    isRunning
      ? (selectedDeviceSessionState.applicationSession.profilingReactState.get() ?? "stopped")
      : "stopped"
  );

  const maestroTestState = use$(() =>
    isRunning
      ? (selectedDeviceSessionState.applicationSession.maestroTestState.get() ?? "stopped")
      : "stopped"
  );

  return (
    <div className="panel-view" data-testid="radon-panel-view">
      <div className="button-group-top">
        <div className="button-group-top-left">
          <UrlBar disabled={!selectedProjectDevice} />
        </div>
        <div className="button-group-top-right">
          <ActiveToolButton
            toolState={profilingCPUState}
            title="Stop profiling CPU"
            onClick={stopProfilingCPU}
            dataTest="radon-top-bar-cpu-profiling-button"
          />
          <ActiveToolButton
            toolState={profilingReactState}
            title="Stop profiling React"
            onClick={stopProfilingReact}
            dataTest="radon-top-bar-react-profiling-button"
          />
          <ActiveToolButton
            toolState={frameReportingEnabled ? "profiling" : "stopped"}
            title={"FPS: " + (fps ?? 0)}
            onClick={stopReportingFrameRate}
          />
          <ActiveTestButton
            testState={maestroTestState}
            title="Abort Maestro test"
            onClick={stopMaestroTest}
            dataTest="radon-top-bar-maestro-test-button"
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
            disabled={!navBarButtonsActive}
            dataTest="toggle-recording-button">
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
              dataTest="radon-top-bar-show-replay-button"
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
            disabled={!navBarButtonsActive}
            dataTest="capture-screenshot-button">
            <span slot="start" className="codicon codicon-device-camera" />
          </IconButton>
          <IconButton
            counter={logCounter}
            counterMode="compact"
            dataTest="radon-top-bar-debug-console-button"
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
          dataTest="radon-bottom-bar-element-inspector-button"
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
        {Platform.OS === "macos" && licenseStatus === LicenseStatus.Inactive && (
          <ActivateLicenseButton />
        )}
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
