import { useEffect, useMemo, useState } from "react";
import "./EditAndroidDevice.css";
import { VSCodeButton, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { useGlobalStateContext } from "../providers/GlobalStateProvider";

function EditAndroidDevice({ className, installedAndroidImages }) {
  const { androidDevices, updateDevice } = useGlobalStateContext();
  const [selectedDeviceId, setSelectedDeviceId] = useState(androidDevices[0]?.id ?? undefined);
  const [selectedImage, setSelectedImage] = useState(installedAndroidImages[0]);

  useEffect(() => {
    const selectedDevice = androidDevices.find((device) => device.id === selectedDeviceId);
    if (selectedDevice) setSelectedImage(selectedDevice.systemImage);
    else setSelectedImage(installedAndroidImages[0]);
  }, [androidDevices]);

  const selectedDevice = useMemo(
    () => androidDevices.find((device) => device.id === selectedDeviceId),
    [selectedDeviceId, androidDevices]
  );

  const saveDisabled =
    !selectedImage ||
    (selectedDevice?.systemImage?.path === selectedImage?.path &&
      !!selectedDevice?.systemImage?.path);

  const handleSave = () => {
    updateDevice({ ...selectedDevice, systemImage: selectedImage });
  };

  if (!androidDevices?.length) return null;

  return (
    <div className={className}>
      <h3>Edit your devices</h3>
      <div className="edit-device-panel">
        <VSCodeDropdown
          className="device-dropdown"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}>
          <span slot="start" className="codicon codicon-device-mobile" />
          {androidDevices.map((device) => (
            <VSCodeOption key={device.id} value={device.id}>
              {device.name}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>

        <VSCodeDropdown
          className="image-dropdown"
          value={selectedImage?.path}
          onChange={(e) => {
            const image = installedAndroidImages.find(
              (installedImage) => installedImage.path === e.target.value
            );
            setSelectedImage(image);
          }}>
          <span slot="start" className="codicon codicon-package" />
          {installedAndroidImages.map((image) => (
            <VSCodeOption key={image.path} value={image.path}>
              {image.apiLevel} - {image.description}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>

        <VSCodeButton appearance="secondary" disabled={saveDisabled} onClick={handleSave}>
          Save
        </VSCodeButton>
      </div>
    </div>
  );
}

export default EditAndroidDevice;
