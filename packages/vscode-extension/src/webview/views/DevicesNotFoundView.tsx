import "./DevicesNotFoundView.css";
import SmartphoneIcon from "../components/icons/SmartphoneIcon";
import Button from "../components/shared/Button";
import { useModal } from "../providers/ModalProvider";
import CreateDeviceView from "./CreateDeviceView";
import { useDevices } from "../providers/DevicesProvider";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
import { SupportedAndroidDevices, SupportedIOSDevices } from "../utilities/consts";

function DevicesNotFoundView() {
  const { openModal, closeModal } = useModal();
  const { iOSRuntimes, androidImages, deviceManager } = useDevices();
  const [isIOSCreating, setIOSCreating] = useState(false);
  const [isAndroidCreating, setAndroidCreating] = useState(false);

  function openCreateNewDeviceModal() {
    openModal(
      "Create new device",
      <CreateDeviceView onCancel={closeModal} onCreate={closeModal} />
    );
  }

  async function createAndroidDevice() {
    setAndroidCreating(true);
    try {
      if (androidImages.length === 0) {
        openCreateNewDeviceModal();
        return;
      }
      let newestAPIImage = androidImages[0];
      for (const image of androidImages) {
        if (image.apiLevel > newestAPIImage.apiLevel) {
          newestAPIImage = image;
        }
      }
      await deviceManager.createAndroidDevice(SupportedAndroidDevices.PIXEL_7, newestAPIImage);
    } finally {
      setAndroidCreating(false);
    }
  }

  async function createIOSDevice() {
    setIOSCreating(true);
    try {
      let newestRuntime = undefined;
      for (const runtime of iOSRuntimes) {
        if (
          (newestRuntime === undefined || runtime.version > newestRuntime.version) &&
          runtime.supportedDeviceTypes.find((dt) => dt.name === SupportedIOSDevices.IPHONE_15_PRO)
        ) {
          newestRuntime = runtime;
        }
      }
      if (newestRuntime === undefined) {
        openCreateNewDeviceModal();
        return;
      }
      const iOSDeviceType = newestRuntime.supportedDeviceTypes.find(
        (dt) => dt.name === SupportedIOSDevices.IPHONE_15_PRO
      );
      await deviceManager.createIOSDevice(iOSDeviceType!, newestRuntime);
    } finally {
      setIOSCreating(false);
    }
  }
  return (
    <div className="devices-not-found-container">
      <div className="devices-not-found-icon">
        <SmartphoneIcon color="var(--background-dark-100)" />
      </div>
      <h1>No devices found</h1>
      <p className="devices-not-found-subtitle">
        You can add a new device using the quick action below.
      </p>
      <div className="devices-not-found-button-group">
        <Button type="ternary" className="devices-not-found-quick-action" onClick={createIOSDevice}>
          {isIOSCreating && <VSCodeProgressRing className="devices-not-found-button-spinner" />}
          Add iPhone
        </Button>
        <Button
          type="ternary"
          className="devices-not-found-quick-action"
          onClick={createAndroidDevice}>
          {isAndroidCreating && <VSCodeProgressRing className="devices-not-found-button-spinner" />}
          Add Android
        </Button>
      </div>
      <p>or</p>
      <Button onClick={openCreateNewDeviceModal}>
        <span className="codicon codicon-add" />
        Create new device
      </Button>
    </div>
  );
}
export default DevicesNotFoundView;
