import { useState, useEffect, useMemo } from "react";
import { vscode } from "../utilities/vscode";
import Preview from "../components/Preview";
import { VSCodeButton, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import IconButton from "../components/shared/IconButton";
import UrlBar from "../components/UrlBar";
import LogPanel from "../components/LogPanel";
import LogCounter from "../components/LogCounter";
import SettingsDropdown from "../components/SettingsDropdown";
import { useWorkspaceStateContext } from "../providers/WorkspaceStateProvider";
import "./View.css";
import "./PreviewView.css";
import { useModal } from "../providers/ModalProvider";
import ManageDevicesView from "./ManageDevicesView";
import { MANAGE_DEVICE_OPTION_NAME } from "../utilities/consts";
import { useSystemImagesContext } from "../providers/SystemImagesProvider";
import { PLATFORM } from "../utilities/device";
import DeviceSettingsDropdown from "../components/DeviceSettingsDropdown";
import DeviceSettingsIcon from "../components/icons/DeviceSettingsIcon";

function setCssPropertiesForDevice(device) {
  // top right bottom left
  const m = device.backgroundMargins;
  const size = device.backgroundSize;
  document.documentElement.style.setProperty(
    "--phone-content-margins",
    `${((m[0] + m[2]) / size[0]) * 100}% 0% 0% ${(m[1] / size[1]) * 100}%`
  );

  document.documentElement.style.setProperty(
    "--phone-content-height",
    `${((size[0] - m[0] - m[2]) / size[0]) * 100}%`
  );
  document.documentElement.style.setProperty(
    "--phone-content-width",
    `${((size[1] - m[1] - m[3]) / size[1]) * 100}%`
  );
  document.documentElement.style.setProperty(
    "--phone-content-border-radius",
    device.backgroundBorderRadius
  );

  document.documentElement.style.setProperty(
    "--phone-content-aspect-ratio",
    `${device.width} / ${device.height}`
  );
}

const INITIAL_DEVICE_SETTINGS = {
  appearance: "dark",
  contentSize: "normal",
};

function PreviewView() {
  const [deviceId, setDeviceId] = useState(undefined);
  const [deviceSettings, setDeviceSettings] = useState(INITIAL_DEVICE_SETTINGS);
  const [previewURL, setPreviewURL] = useState();
  const [isInspecing, setIsInspecting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logCounter, setLogCounter] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [inspectData, setInspectData] = useState(null);
  const [isError, setIsError] = useState(false);

  const { openModal } = useModal();
  const { devices } = useWorkspaceStateContext();
  const { isDeviceImageInstalled } = useSystemImagesContext();

  const selectedDevice = useMemo(
    () => devices.find((device) => deviceId === device.id),
    [deviceId, devices]
  );

  useEffect(() => {
    if (selectedDevice) {
      setCssPropertiesForDevice(selectedDevice);
    }
  }, [selectedDevice]);

  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      switch (message.command) {
        case "appReady":
          setPreviewURL(message.previewURL);
          break;
        case "inspectData":
          setInspectData(message.data);
          break;
        case "logEvent":
          setLogCounter((logCounter) => logCounter + 1);
          break;
        case "consoleLog":
          setLogs((logs) => [{ type: "log", text: message.text }, ...logs]);
          break;
        case "consoleStack":
          setLogs((logs) => [
            {
              type: "stack",
              text: message.text,
              stack: message.stack,
              isFatal: message.isFatal,
            },
            ...logs,
          ]);
          break;
        case "projectError":
          if (
            (!message.androidBuildFailed && selectedDevice.platform === "Android") ||
            (!message.iosBuildFailed && selectedDevice.platorm === "iOS")
          ) {
            setIsError(false);
          }
          setIsError(true);
          break;
      }
    };
    window.addEventListener("message", listener);

    return () => window.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    if (deviceId || !devices.length) {
      return;
    }

    const initialDevice = devices.find(
      (device) =>
        (device.platform === PLATFORM.IOS && device.runtime) ||
        (device.platform === PLATFORM.ANDROID && device.systemImage)
    );

    if (!initialDevice) {
      return;
    }

    setDeviceId(initialDevice.id);
    vscode.postMessage({
      command: "startProject",
      settings: deviceSettings,
      device: initialDevice,
    });
  }, [devices]);

  const handleRestart = () => {
    setPreviewURL(undefined);
    setIsError(false);
    vscode.postMessage({
      command: "restartProject",
      settings: deviceSettings,
      device: selectedDevice,
    });
  };

  const handleDeviceDropdownChange = (e) => {
    if (e.target.value === MANAGE_DEVICE_OPTION_NAME) {
      openModal(MANAGE_DEVICE_OPTION_NAME, <ManageDevicesView />);
      return;
    }
    if (selectedDevice.id !== e.target.value) {
      const newDevice = devices.find((d) => d.id === e.target.value);
      setDeviceId(newDevice.id);
      setPreviewURL(undefined);
      setIsError(false);
      vscode.postMessage({
        command: "changeDevice",
        settings: deviceSettings,
        device: newDevice,
      });
    }
  };

  return (
    <div className="panel-view">
      <div className="button-group-top">
        <IconButton
          tooltip={{
            label: "Follow active editor on the device",
            side: "bottom",
          }}
          active={isFollowing}
          onClick={() => {
            vscode.postMessage({
              command: isFollowing ? "stopFollowing" : "startFollowing",
            });
            setIsFollowing(!isFollowing);
          }}>
          <span className="codicon codicon-magnet" />
        </IconButton>

        <span className="group-separator" />

        <UrlBar onRestart={handleRestart} />

        <div className="spacer" />

        <VSCodeButton
          appearance={"secondary"}
          onClick={() => {
            setLogCounter(0);
            vscode.postMessage({ command: "openLogs" });
          }}>
          <span slot="start" className="codicon codicon-debug-console" />
          Logs
          <LogCounter count={logCounter} />
        </VSCodeButton>
        <SettingsDropdown>
          <IconButton
            onClick={() => {
              vscode.postMessage({ command: "openSettings" });
            }}
            tooltip={{ label: "Settings", side: "bottom" }}>
            <span className="codicon codicon-settings-gear" />
          </IconButton>
        </SettingsDropdown>
      </div>
      {selectedDevice ? (
        <Preview
          key={previewURL}
          isInspecting={isInspecing}
          previewURL={previewURL}
          device={selectedDevice}
          inspectData={inspectData}
          setIsInspecting={setIsInspecting}
          setInspectData={setInspectData}
          isError={isError}
          onRestartClick={handleRestart}
        />
      ) : (
        <div className="missing-device-filler" />
      )}

      <div className="button-group-bottom">
        <IconButton
          active={isInspecing}
          tooltip={{
            label: "Select an element to inspect it",
          }}
          onClick={() => {
            if (isInspecing) {
              setInspectData(null);
            }
            setIsInspecting(!isInspecing);
          }}>
          <span className="codicon codicon-inspect" />
        </IconButton>

        <span className="group-separator" />

        <VSCodeDropdown
          className="device-select"
          value={deviceId}
          onChange={handleDeviceDropdownChange}>
          <span slot="start" className="codicon codicon-device-mobile" />
          {devices.map((device) => (
            <VSCodeOption
              key={device.id}
              value={device.id}
              disabled={!isDeviceImageInstalled(device)}>
              {device.name}
            </VSCodeOption>
          ))}
          {!!devices.length && <div className="dropdown-separator" />}
          <VSCodeOption
            appearance="secondary"
            key={MANAGE_DEVICE_OPTION_NAME}
            value={MANAGE_DEVICE_OPTION_NAME}>
            {MANAGE_DEVICE_OPTION_NAME}
          </VSCodeOption>
        </VSCodeDropdown>

        <div className="spacer" />
        <DeviceSettingsDropdown
          deviceSettings={deviceSettings}
          setDeviceSettings={setDeviceSettings}>
          <IconButton tooltip={{ label: "Device settings", side: "top" }}>
            <DeviceSettingsIcon />
          </IconButton>
        </DeviceSettingsDropdown>
      </div>
      <LogPanel expandedLogs={expandedLogs} logs={logs} />
    </div>
  );
}

export default PreviewView;
