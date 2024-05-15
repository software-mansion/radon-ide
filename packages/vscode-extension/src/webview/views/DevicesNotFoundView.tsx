import "./DevicesNotFoundView.css";
import SmartphoneIcon from "../components/icons/SmartphoneIcon";
import Button from "../components/shared/Button";
import { useModal } from "../providers/ModalProvider";
import CreateDeviceView from "./CreateDeviceView";
import { useDevices } from "../providers/DevicesProvider";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
import { SupportedDevices } from "../utilities/consts";
import { Platform } from "../../common/DeviceManager";
import { useDependencies } from "../providers/DependenciesProvider";
import { DiagnosticError } from "./DiagnosticView";

function DevicesNotFoundView() {
  const { openModal, closeModal } = useModal();
  const { iOSRuntimes, androidImages, deviceManager } = useDevices();
  const [isIOSCreating, setIOSCreating] = useState(false);
  const [isAndroidCreating, setAndroidCreating] = useState(false);
  const { dependencies, isAndroidEmulatorError, isIosSimulatorError } = useDependencies();

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
      await deviceManager.createAndroidDevice(
        SupportedDevices.find((sd) => {
          return sd.platform === Platform.Android;
        })!.name,
        newestAPIImage
      );
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
          runtime.supportedDeviceTypes.find(
            (dt) =>
              dt.name ===
              SupportedDevices.find((sd) => {
                return sd.platform === Platform.IOS;
              })?.name
          )
        ) {
          newestRuntime = runtime;
        }
      }
      if (newestRuntime === undefined) {
        openCreateNewDeviceModal();
        return;
      }
      const iOSDeviceType = newestRuntime.supportedDeviceTypes.find(
        (dt) =>
          dt.name ===
          SupportedDevices.find((sd) => {
            return sd.platform === Platform.IOS;
          })?.name
      );
      await deviceManager.createIOSDevice(iOSDeviceType!, newestRuntime);
    } finally {
      setIOSCreating(false);
    }
  }
  return (
    <div className="devices-not-found-container">
      <div className="devices-not-found-icon">
        <SmartphoneIcon color="var(--swm-devices-not-found-icon)" />
      </div>
      <h1 className="devices-not-found-title">No devices found</h1>
      <p className="devices-not-found-subtitle">
        You can add a new device using the quick action below.
      </p>
      <div className="devices-not-found-button-group">
        <Button
          type="ternary"
          className="devices-not-found-quick-action"
          onClick={createIOSDevice}
          disabled={isIosSimulatorError}>
          {isIOSCreating && <VSCodeProgressRing className="devices-not-found-button-spinner" />}
          Add iPhone
        </Button>

        <Button
          type="ternary"
          className="devices-not-found-quick-action"
          onClick={createAndroidDevice}
          disabled={isAndroidEmulatorError}>
          {isAndroidCreating && <VSCodeProgressRing className="devices-not-found-button-spinner" />}
          Add Android
        </Button>
      </div>
      {!(isAndroidEmulatorError && isIosSimulatorError) && (
        <>
          <p>or</p>
          <Button onClick={openCreateNewDeviceModal}>
            <span className="codicon codicon-add" />
            Create new device
          </Button>
        </>
      )}
      <div>
        {isAndroidEmulatorError && (
          <DiagnosticError message={dependencies.AndroidEmulator!.error!} />
        )}
        {isIosSimulatorError && <DiagnosticError message={dependencies.Xcode!.error!} />}
      </div>
    </div>
  );
}
export default DevicesNotFoundView;
