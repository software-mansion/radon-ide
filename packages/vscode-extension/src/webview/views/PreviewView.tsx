import { useState, useEffect, useCallback } from "react";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import Preview from "../components/Preview";
import IconButton from "../components/shared/IconButton";
import UrlBar from "../components/UrlBar";
import SettingsDropdown from "../components/SettingsDropdown";
import { useModal } from "../providers/ModalProvider";
import ManageDevicesView from "./ManageDevicesView";
import DevicesNotFoundView from "./DevicesNotFoundView";
import DeviceSettingsDropdown from "../components/DeviceSettingsDropdown";
import DeviceSettingsIcon from "../components/icons/DeviceSettingsIcon";
import { useDevices } from "../providers/DevicesProvider";
import { useProject } from "../providers/ProjectProvider";
import DeviceSelect from "../components/DeviceSelect";
import { InspectDataMenu } from "../components/InspectDataMenu";
import Button from "../components/shared/Button";
import { Frame, InspectDataStackItem, InspectStackData, ZoomLevelType } from "../../common/Project";
import { Platform, useUtils } from "../providers/UtilsProvider";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/consts";
import "./View.css";
import "./PreviewView.css";
import ReplayIcon from "../components/icons/ReplayIcon";
import RecordingIcon from "../components/icons/RecordingIcon";
import { ActivateLicenseView } from "./ActivateLicenseView";
import ScreenshotIcon from "../components/icons/ScreenshotIcon";

type LoadingComponentProps = {
  finishedInitialLoad: boolean;
  devicesNotFound: boolean;
};

function LoadingComponent({ finishedInitialLoad, devicesNotFound }: LoadingComponentProps) {
  if (!finishedInitialLoad) {
    return (
      <div className="missing-device-filler">
        <VSCodeProgressRing />
      </div>
    );
  }

  return (
    <div className="missing-device-filler">
      {devicesNotFound ? <DevicesNotFoundView /> : <VSCodeProgressRing />}
    </div>
  );
}

function ActivateLicenseButton() {
  const { openModal } = useModal();
  return (
    <Button
      className="activate-license-button"
      onClick={() => openModal("Activate License", <ActivateLicenseView />)}>
      Activate License
    </Button>
  );
}

function PreviewView() {
  const {
    projectState,
    project,
    deviceSettings,
    hasActiveLicense,
    replayData,
    isRecording,
    setReplayData,
  } = useProject();
  const { showDismissableError } = useUtils();

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
  const [logCounter, setLogCounter] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const { devices, finishedInitialLoad } = useDevices();

  const selectedDevice = projectState?.selectedDevice;
  const devicesNotFound = projectState !== undefined && devices.length === 0;
  const isStarting = projectState.status === "starting";
  const isRunning = projectState.status === "running";

  const deviceProperties = iOSSupportedDevices.concat(AndroidSupportedDevices).find((sd) => {
    return sd.modelId === projectState?.selectedDevice?.modelId;
  });

  const { openModal } = useModal();
  const { openFileAt } = useUtils();

  useEffect(() => {
    function incrementLogCounter() {
      setLogCounter((c) => c + 1);
    }
    project.addListener("log", incrementLogCounter);

    return () => {
      project.removeListener("log", incrementLogCounter);
    };
  }, []);

  useEffect(() => {
    if (isStarting) {
      setLogCounter(0);
      setResetKey((prevKey) => prevKey + 1);
    }
  }, [setLogCounter, isStarting]);

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

  const handleDeviceDropdownChange = async (value: string) => {
    if (value === "manage") {
      openModal("Manage Devices", <ManageDevicesView />);
      return;
    }
    if (selectedDevice?.id !== value) {
      const deviceInfo = devices.find((d) => d.id === value);
      if (deviceInfo) {
        project.selectDevice(deviceInfo);
      }
    }
  };

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
    setInspectFrame(null);
    setInspectStackData(null);
  }

  const showReplayButton = deviceSettings.replaysEnabled;

  const recordingTimeFormat = `${Math.floor(recordingTime / 60)}:${(recordingTime % 60)
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="panel-view">
      <div className="button-group-top">
        <UrlBar key={resetKey} disabled={devicesNotFound} />
        <div className="spacer" />
        {
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
        }
        {showReplayButton && (
          <IconButton
            tooltip={{
              label: "Replay the last few seconds of the app",
            }}
            onClick={handleReplay}
            disabled={isStarting || isRecording}>
            <ReplayIcon />
          </IconButton>
        )}
        <IconButton
          tooltip={{
            label: "Capture a screenshot of the app",
          }}
          onClick={captureScreenshot}
          disabled={isStarting}>
          <ScreenshotIcon />
        </IconButton>
        <IconButton
          counter={logCounter}
          onClick={() => {
            setLogCounter(0);
            project.focusDebugConsole();
          }}
          tooltip={{
            label: "Open logs panel",
          }}
          disabled={devicesNotFound}>
          <span slot="start" className="codicon codicon-debug-console" />
        </IconButton>
        <SettingsDropdown project={project} isDeviceRunning={isRunning} disabled={devicesNotFound}>
          <IconButton tooltip={{ label: "Settings", type: "primary" }}>
            <span className="codicon codicon-settings-gear" />
          </IconButton>
        </SettingsDropdown>
      </div>

      {selectedDevice && finishedInitialLoad ? (
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
      ) : (
        <LoadingComponent
          finishedInitialLoad={finishedInitialLoad}
          devicesNotFound={devicesNotFound}
        />
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
          onCancel={() => resetInspector()}
        />
      )}

      <div className="button-group-bottom">
        <IconButton
          active={isInspecting}
          tooltip={{
            label: "Select an element to inspect it",
          }}
          onClick={() => setIsInspecting(!isInspecting)}
          disabled={devicesNotFound}>
          <span className="codicon codicon-inspect" />
        </IconButton>

        <span className="group-separator" />

        <DeviceSelect
          devices={devices}
          // @ts-ignore TODO: Fix typing
          value={selectedDevice?.id}
          // @ts-ignore TODO: Fix typing
          label={selectedDevice?.displayName}
          onValueChange={handleDeviceDropdownChange}
          disabled={devicesNotFound}
        />

        <div className="spacer" />
        {Platform.OS === "macos" && !hasActiveLicense && <ActivateLicenseButton />}
        <DeviceSettingsDropdown disabled={devicesNotFound || !isRunning}>
          <IconButton tooltip={{ label: "Device settings", type: "primary" }}>
            <DeviceSettingsIcon
              color={
                devicesNotFound || !isRunning
                  ? "var(--swm-disabled-text)"
                  : "var(--swm-default-text)"
              }
            />
          </IconButton>
        </DeviceSettingsDropdown>
      </div>
    </div>
  );
}

export default PreviewView;
