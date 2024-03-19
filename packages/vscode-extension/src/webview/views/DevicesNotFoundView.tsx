import "./DevicesNotFoundView.css";
import SmartphoneIcon from "../components/icons/SmartphoneIcon";
import Button from "../components/shared/Button";
import { useModal } from "../providers/ModalProvider";
import CreateDeviceView, { SupportedAndroidDevice, SupportedIOSDevice } from "./CreateDeviceView";
import { useDevices } from "../providers/DevicesProvider";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";

const RUNTIME_IDENTIFIER = "com.apple.CoreSimulator.SimRuntime.iOS-17-2";
const IMAGE_LOCATION = "system-images/android-31/google_apis/arm64-v8a";

function DevicesNotFoundView() {
  const { openModal, closeModal } = useModal();
  const { iOSRuntimes, androidImages, deviceManager } = useDevices();
  const [isIOSCreating, setIOSCreating] = useState(false);
  const [isAndroidCreating, setAndroidCreating] = useState(false);

  async function createAndroidDevice() {
    setAndroidCreating(true);
    const systemImage = androidImages.find((image) => image.location === IMAGE_LOCATION);
    if (!systemImage) {
      return;
    }
    await deviceManager.createAndroidDevice(SupportedAndroidDevice.PIXEL_7, systemImage);
    try {
    } finally {
      setAndroidCreating(false);
    }
  }

  async function createIOSDevice() {
    setIOSCreating(true);
    try {
      const runtime = iOSRuntimes.find((runtime) => runtime.identifier === RUNTIME_IDENTIFIER);
      if (!runtime) {
        return;
      }
      const iOSDeviceType = runtime.supportedDeviceTypes.find(
        (dt) => dt.name === SupportedIOSDevice.IPHONE_15_PRO
      );
      if (!iOSDeviceType) {
        return;
      }
      await deviceManager.createIOSDevice(iOSDeviceType, runtime);
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
          Add iPhone 15 Pro
        </Button>
        <Button
          type="ternary"
          className="devices-not-found-quick-action"
          onClick={createAndroidDevice}>
          {isAndroidCreating && <VSCodeProgressRing className="devices-not-found-button-spinner" />}
          Add Google Pixel 7
        </Button>
      </div>
      <p>or</p>
      <Button
        onClick={() => {
          openModal(
            "Manage Devices",
            <CreateDeviceView onCancel={closeModal} onCreate={closeModal} />
          );
        }}>
        <span className="codicon codicon-add" />
        Create new device
      </Button>
    </div>
  );
}
export default DevicesNotFoundView;
