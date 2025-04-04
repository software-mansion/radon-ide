import "./NoDeviceView.css";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { useCallback, useState } from "react";
import SmartphoneIcon from "../components/icons/SmartphoneIcon";
import Button from "../components/shared/Button";
import { useModal } from "../providers/ModalProvider";
import CreateDeviceView from "./CreateDeviceView";
import { useDevices } from "../providers/DevicesProvider";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/deviceContants";
import { IOSDeviceTypeInfo, IOSRuntimeInfo } from "../../common/DeviceManager";
import { useDependencies } from "../providers/DependenciesProvider";
import { Platform, useUtils } from "../providers/UtilsProvider";
import ManageDevicesView from "./ManageDevicesView";

const firstIosDevice = iOSSupportedDevices[0];
const firstAndroidDevice = AndroidSupportedDevices[0];

function getMax<T>(array: T[], predicate: (element: T, currentMax: T) => boolean): T | undefined {
  if (array.length === 0) {
    return undefined;
  }

  let max = array[0];
  for (const element of array) {
    if (predicate(element, max)) {
      max = element;
    }
  }
  return max;
}

function useLoadingState() {
  const [state, setState] = useState(false);
  const withLoading = useCallback(
    async (fn: () => Promise<void>) => {
      setState(true);
      try {
        await fn();
      } finally {
        setState(false);
      }
    },
    [setState]
  );

  return [state, withLoading] as const;
}

function firstRuntimeSupportedDevice(supportedDeviceTypes: IOSDeviceTypeInfo[]) {
  return supportedDeviceTypes.find(({ name }) => name === firstIosDevice.modelName);
}

function findNewestIosRuntime(runtimes: IOSRuntimeInfo[]) {
  function isNewest(runtime: IOSRuntimeInfo, currentNewestRuntime: IOSRuntimeInfo) {
    const newer = runtime.version > currentNewestRuntime.version;
    if (!newer) {
      return false;
    }
    const isSupported = firstRuntimeSupportedDevice(runtime.supportedDeviceTypes) !== undefined;
    return isSupported;
  }

  return getMax(runtimes, isNewest);
}

export default function NoDeviceView({ hasNoDevices }: { hasNoDevices: boolean }) {
  const { openModal, closeModal } = useModal();
  const { iOSRuntimes, androidImages, deviceManager } = useDevices();
  const [isIOSCreating, withIosCreating] = useLoadingState();
  const [isAndroidCreating, withAndroidCreating] = useLoadingState();
  const { errors } = useDependencies();
  const utils = useUtils();

  function openCreateNewDeviceModal() {
    openModal(
      "Create new device",
      <CreateDeviceView onCancel={closeModal} onCreate={closeModal} />
    );
  }

  function openManageDevicesModal() {
    openModal("Manage devices", <ManageDevicesView />);
  }

  async function createAndroidDevice() {
    if (errors?.emulator) {
      utils.showDismissableError(errors?.emulator.message);
      return;
    }

    await withAndroidCreating(async () => {
      const newestImage = getMax(
        androidImages,
        (image, currentNewestImage) => image.apiLevel > currentNewestImage.apiLevel
      );

      if (newestImage === undefined) {
        openCreateNewDeviceModal();
        return;
      }

      const { modelId, modelName } = firstAndroidDevice;
      await deviceManager.createAndroidDevice(modelId, modelName, newestImage);
    });
  }

  async function createIOSDevice() {
    if (errors?.simulator) {
      utils.showDismissableError(errors.simulator.message);
      return;
    }

    await withIosCreating(async () => {
      const newestRuntime = findNewestIosRuntime(iOSRuntimes);
      if (newestRuntime === undefined) {
        openCreateNewDeviceModal();
        return;
      }
      const iOSDeviceType = firstRuntimeSupportedDevice(newestRuntime.supportedDeviceTypes);
      await deviceManager.createIOSDevice(iOSDeviceType!, iOSDeviceType!.name, newestRuntime);
    });
  }
  return (
    <div className="devices-not-found-container">
      <div className="devices-not-found-icon">
        <SmartphoneIcon color="var(--swm-devices-not-found-icon)" />
      </div>
      <h1 className="devices-not-found-title">
        {hasNoDevices ? "No devices found" : "Select a device to start"}
      </h1>
      <p className="devices-not-found-subtitle">
        {hasNoDevices
          ? "You can add a new device using the quick action below."
          : "You can select one of available devices or create a new one to start."}
      </p>
      {hasNoDevices ? (
        <div className="devices-not-found-button-group">
          {Platform.OS === "macos" && (
            <Button
              disabled={isIOSCreating}
              type="ternary"
              className="devices-not-found-quick-action"
              onClick={createIOSDevice}>
              {isIOSCreating && <VSCodeProgressRing className="devices-not-found-button-spinner" />}
              Add iPhone
            </Button>
          )}

          <Button
            disabled={isAndroidCreating}
            type="ternary"
            className="devices-not-found-quick-action"
            onClick={createAndroidDevice}>
            {isAndroidCreating && (
              <VSCodeProgressRing className="devices-not-found-button-spinner" />
            )}
            Add Android
          </Button>
        </div>
      ) : (
        <Button onClick={openManageDevicesModal}>
          <span className="codicon codicon-device-mobile" />
          Select existing device
        </Button>
      )}
      <p>or</p>
      <Button onClick={openCreateNewDeviceModal}>
        <span className="codicon codicon-add" />
        Create new device
      </Button>
    </div>
  );
}
