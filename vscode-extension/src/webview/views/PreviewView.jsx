import { useState, useEffect } from "react";
import { vscode } from "../utilities/vscode";
import Preview from "../components/Preview";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import IconButton from "../components/shared/IconButton";
import UrlBar from "../components/UrlBar";
import LogCounter from "../components/LogCounter";
import SettingsDropdown from "../components/SettingsDropdown";
import "./View.css";
import "./PreviewView.css";
import { useModal } from "../providers/ModalProvider";
import ManageDevicesView from "./ManageDevicesView";
import DeviceSettingsDropdown from "../components/DeviceSettingsDropdown";
import DeviceSettingsIcon from "../components/icons/DeviceSettingsIcon";
import { useDevices } from "../providers/DevicesProvider";
import { useProject } from "../providers/ProjectProvider";
import DeviceSelect from "../components/DeviceSelect";

function PreviewView() {
  const [isInspecing, setIsInspecting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [logCounter, setLogCounter] = useState(0);

  const { openModal } = useModal();

  const { devices } = useDevices();
  const { projectState, project } = useProject();

  const selectedDevice = projectState?.selectedDevice;

  useEffect(() => {
    function incrementLogCounter() {
      setLogCounter((c) => c + 1);
    }
    project.addListener("log", incrementLogCounter);

    return () => {
      project.removeListener("log", incrementLogCounter);
    };
  }, []);

  const handleDeviceDropdownChange = async (value) => {
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

        <UrlBar project={project} />

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
        <SettingsDropdown project={project}>
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
          key={selectedDevice.id}
          isInspecting={isInspecing}
          setIsInspecting={setIsInspecting}
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
          onClick={() => setIsInspecting(!isInspecing)}>
          <span className="codicon codicon-inspect" />
        </IconButton>

        <span className="group-separator" />

        <DeviceSelect
          devices={devices}
          value={selectedDevice?.id}
          label={selectedDevice?.name}
          onValueChange={handleDeviceDropdownChange}
        />

        <div className="spacer" />
        <DeviceSettingsDropdown>
          <IconButton tooltip={{ label: "Device settings", side: "top" }}>
            <DeviceSettingsIcon />
          </IconButton>
        </DeviceSettingsDropdown>
      </div>
    </div>
  );
}

export default PreviewView;
