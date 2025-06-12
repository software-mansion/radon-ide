import { useState } from "react";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import { DeviceSettings } from "../../common/Project";
import Button from "../components/shared/Button";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "../components/shared/Dropdown.css";
import "./CameraSettingsView.css";

const backCameraOptions = [
  { label: "Emulated", value: "emulated" },
  { label: "Virtual Scene", value: "virtualscene" },
  { label: "Webcam", value: "webcam0" },
  { label: "None", value: "none" },
];

const frontCameraOptions = [
  { label: "Emulated", value: "emulated" },
  { label: "Webcam", value: "webcam0" },
  { label: "None", value: "none" },
];

export function CameraSettingsView() {
  const { deviceSettings } = useProject();
  const { openModal } = useModal();
  
  const [selectedBackCamera, setSelectedBackCamera] = useState(deviceSettings.camera.back);
  const [selectedFrontCamera, setSelectedFrontCamera] = useState(deviceSettings.camera.front);

  const handleApplyChanges = () => {
    if (selectedBackCamera !== deviceSettings.camera.back || selectedFrontCamera !== deviceSettings.camera.front) {
      openModal("", <CameraChangeConfirmationView 
        backCamera={selectedBackCamera} 
        frontCamera={selectedFrontCamera} 
      />);
    }
  };

  return (
    <div className="camera-settings-container">
      <div className="camera-settings-content">
        <div className="camera-setting-group">
          <label className="camera-setting-label">Back Camera</label>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="camera-dropdown-trigger">
              <span>{backCameraOptions.find(opt => opt.value === selectedBackCamera)?.label}</span>
              <span className="codicon codicon-chevron-down" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="dropdown-menu-content">
                {backCameraOptions.map((option) => (
                  <DropdownMenu.Item
                    key={option.value}
                    className="dropdown-menu-item"
                    onSelect={() => setSelectedBackCamera(option.value as DeviceSettings["camera"]["back"])}>
                    {option.label}
                    {selectedBackCamera === option.value && (
                      <span className="codicon codicon-check right-slot" />
                    )}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div className="camera-setting-group">
          <label className="camera-setting-label">Front Camera</label>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="camera-dropdown-trigger">
              <span>{frontCameraOptions.find(opt => opt.value === selectedFrontCamera)?.label}</span>
              <span className="codicon codicon-chevron-down" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="dropdown-menu-content">
                {frontCameraOptions.map((option) => (
                  <DropdownMenu.Item
                    key={option.value}
                    className="dropdown-menu-item"
                    onSelect={() => setSelectedFrontCamera(option.value as DeviceSettings["camera"]["front"])}>
                    {option.label}
                    {selectedFrontCamera === option.value && (
                      <span className="codicon codicon-check right-slot" />
                    )}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <div className="camera-settings-footer">
        <Button 
          type="primary" 
          onClick={handleApplyChanges}
          disabled={selectedBackCamera === deviceSettings.camera.back && selectedFrontCamera === deviceSettings.camera.front}>
          Apply Changes
        </Button>
      </div>
    </div>
  );
}

type CameraChangeConfirmationViewProps = {
  backCamera: string;
  frontCamera: string;
};

const CameraChangeConfirmationView = ({
  backCamera,
  frontCamera,
}: CameraChangeConfirmationViewProps) => {
  const { openModal, closeModal } = useModal();
  const { project, deviceSettings } = useProject();

  const onCancel = () => {
    openModal("Camera Settings", <CameraSettingsView />);
  };

  return (
    <div className="camera-change-wrapper">
      <h2 className="camera-change-title">
        Confirm Camera Settings Change
      </h2>
      <p className="camera-change-subtitle">
        Changing camera settings will require a device reboot to take effect.
      </p>
      <div className="camera-change-details">
        <p><strong>Back Camera:</strong> {backCameraOptions.find(opt => opt.value === backCamera)?.label}</p>
        <p><strong>Front Camera:</strong> {frontCameraOptions.find(opt => opt.value === frontCamera)?.label}</p>
      </div>
      <div className="camera-change-button-group">
        <Button type="secondary" className="camera-change-button" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="camera-change-button"
          type="ternary"
          onClick={async () => {
            project.updateDeviceSettings({
              ...deviceSettings,
              camera: {
                back: backCamera as DeviceSettings["camera"]["back"],
                front: frontCamera as DeviceSettings["camera"]["front"],
              },
            });
            closeModal();
          }}>
          Confirm and Reboot
        </Button>
      </div>
    </div>
  );
}; 