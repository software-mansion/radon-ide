import { ActivateDeviceResult } from "../utilities/license";
import { DeviceId } from "./DeviceManager";

export type ProjectState = {
  previewZoom: ZoomLevelType | undefined;
  selectedDevice: DeviceId | undefined;
  initialized: boolean;
};

export type ZoomLevelType = number | "Fit";

export interface ProjectEventMap {
  log: { type: string };
  projectStateChanged: ProjectState;
  licenseActivationChanged: boolean;
  navigationChanged: { displayName: string; id: string };
  needsNativeRebuild: void;
}

export interface ProjectEventListener<T> {
  (event: T): void;
}

export type SelectDeviceOptions = {
  preservePreviousDevice?: boolean;
};

export interface ProjectInterface {
  getProjectState(): Promise<ProjectState>;
  updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void>;
  selectDevice(deviceId: DeviceId, selectDeviceOptions?: SelectDeviceOptions): Promise<boolean>;

  getDeepLinksHistory(): Promise<string[]>;

  activateLicense(activationKey: string): Promise<ActivateDeviceResult>;
  hasActiveLicense(): Promise<boolean>;

  addListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ): Promise<void>;
}
