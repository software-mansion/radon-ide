import "./NoDeviceView.css";
import { use$ } from "@legendapp/state/react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import { useCallback, useState } from "react";
import SmartphoneIcon from "../components/icons/SmartphoneIcon";
import Button from "../components/shared/Button";
import { useModal } from "../providers/ModalProvider";
import CreateDeviceView from "./CreateDeviceView";
import { AndroidSupportedDevices, iOSSupportedDevices } from "../utilities/deviceConstants";
import ManageDevicesView from "./ManageDevicesView";
import { Platform, useProject } from "../providers/ProjectProvider";
import { useDependencyErrors } from "../hooks/useDependencyErrors";
import { IOSDeviceTypeInfo, IOSRuntimeInfo } from "../../common/State";
import { useStore } from "../providers/storeProvider";

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
  const store$ = useStore();
  const { openModal, closeModal } = useModal();

  const iOSRuntimes = use$(store$.devicesState.iOSRuntimes) ?? [];
  const androidImages = use$(store$.devicesState.androidImages) ?? [];

  const [isIOSCreating, withIosCreating] = useLoadingState();
  const [isAndroidCreating, withAndroidCreating] = useLoadingState();
  const errors = useDependencyErrors();
  const { project } = useProject();

  function openCreateNewDeviceModal() {
    openModal(<CreateDeviceView onCancel={closeModal} onCreate={closeModal} />, {
      title: "Create new device",
    });
  }

  function openManageDevicesModal() {
    openModal(<ManageDevicesView />, {
      title: "Manage devices",
    });
  }

  function enableRadonConnect() {
    project.enableRadonConnect();
  }

  async function createAndroidDevice() {
    if (errors?.emulator) {
      project.showDismissableError(errors?.emulator.message);
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
      await project.createAndroidDevice(modelId, modelName, newestImage);
    });
  }

  async function createIOSDevice() {
    if (errors?.simulator) {
      project.showDismissableError(errors.simulator.message);
      return;
    }

    await withIosCreating(async () => {
      const newestRuntime = findNewestIosRuntime(iOSRuntimes);
      if (newestRuntime === undefined) {
        openCreateNewDeviceModal();
        return;
      }
      const iOSDeviceType = firstRuntimeSupportedDevice(newestRuntime.supportedDeviceTypes);
      await project.createIOSDevice(iOSDeviceType!, iOSDeviceType!.name, newestRuntime);
    });
  }
  return (
    <div className="devices-not-found-container" data-testid="devices-not-found-container">
      <div className="devices-not-found-icon">
        <SmartphoneIcon color="var(--swm-devices-not-found-icon)" />
      </div>
      <h1 className="devices-not-found-title">
        {hasNoDevices ? "No devices found" : "Select a device to start"}
      </h1>
      <p className="devices-not-found-subtitle" data-testid="devices-not-found-subtitle">
        {hasNoDevices
          ? "You can add a new device using the quick action below."
          : "You can select one of available devices or create a new one to start."}
      </p>
      {hasNoDevices ? (
        <div className="devices-not-found-button-group">
          {Platform.OS === "macos" && (
            <Button
              className="devices-not-found-quick-action"
              disabled={isIOSCreating}
              type="ternary"
              onClick={createIOSDevice}>
              {isIOSCreating && <VscodeProgressRing className="devices-not-found-button-spinner" />}
              Add iPhone
            </Button>
          )}

          <Button
            className="devices-not-found-quick-action"
            disabled={isAndroidCreating}
            type="ternary"
            onClick={createAndroidDevice}>
            {isAndroidCreating && (
              <VscodeProgressRing className="devices-not-found-button-spinner" />
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
      <h2 className="devices-not-found-title">Bring your own device or simulator</h2>
      <Button onClick={enableRadonConnect}>
        <span className="codicon codicon-debug-disconnect" />
        Enable Radon Connect
      </Button>
      <p className="devices-not-found-subtitle">
        Radon Connect allows you to work with existing Metro server, and your own devices or
        simulators connected with it.
      </p>
    </div>
  );
}
