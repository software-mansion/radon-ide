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
import {
  Frame,
  InspectDataStackItem,
  InspectStackData,
  RecordingData,
  ZoomLevelType,
} from "../../common/Project";
import { useUtils } from "../providers/UtilsProvider";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/consts";
import "./View.css";
import "./PreviewView.css";
import ReplayIcon from "../components/icons/ReplayIcon";
import RecordingIcon from "../components/icons/RecordingIcon";

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

function PreviewView() {
  const { projectState, project, deviceSettings } = useProject();
  const { reportIssue, showDismissableError } = useUtils();

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  // const [recordingData, setRecordingData] = useState<RecordingData | undefined>(undefined);
  const [replayData, setReplayData] = useState<RecordingData | undefined>(undefined);
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

  const extensionVersion = document.querySelector<HTMLMetaElement>(
    "meta[name='radon-ide-version']"
  )?.content;

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

  const MAX_RECORDING_TIME = 10;
  useEffect(() => {
    if (!isRecording) {
      setRecordingTime(0);
      return;
    }

    const interval = setInterval(() => {
      setRecordingTime((prevRecordingTime) => {
        if (prevRecordingTime >= MAX_RECORDING_TIME - 1) {
          clearInterval(interval);
          handleRecordingTimeExceeded();
          return MAX_RECORDING_TIME;
        }
        return prevRecordingTime + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
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

  const handleRecording = async () => {
    try {
      if (isRecording) {
        // setIsRecording  // TODO recording handler
      } else {
        // setIsRecording  // TODO recording handler
      }
      setIsRecording(!isRecording);
    } catch (e) {
      showDismissableError("Failed to start recording");
    }
  };

  const handleRecordingTimeExceeded = async () => {};

  const handleReplay = async () => {
    try {
      setReplayData(await project.captureReplay());
    } catch (e) {
      showDismissableError("Failed to capture replay");
    }
  };

  function onInspectorItemSelected(item: InspectDataStackItem) {
    openFileAt(item.source.fileName, item.source.line0Based, item.source.column0Based);
    setIsInspecting(false);
  }

  function resetInspector() {
    setInspectFrame(null);
    setInspectStackData(null);
  }

  const showRecordigngButton = deviceSettings.recordingEnabled;
  const showReplayButton = deviceSettings.replaysEnabled;

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
            onClick={handleRecording}
            disabled={isStarting}>
            {isRecording ? <span className="codicon codicon-debug-stop" /> : <RecordingIcon />}
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
        <Button className="feedback-button" onClick={() => reportIssue()}>
          {extensionVersion || "Beta"}: Report issue
        </Button>
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
