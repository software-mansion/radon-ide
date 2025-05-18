import { DeviceId } from "./DeviceManager";

export enum ServerResponseStatusCode {
  success = "S001",
  badRequest = "E001",
  noSubscription = "E002",
  allSeatTaken = "E003",
  seatRemoved = "E004",
  licenseExpired = "E005",
  licenseCancelled = "E006",
  noProductForSubscription = "E007",
  internalError = "E101",
}

export enum SimServerLicenseValidationResult {
  Success,
  Corrupted,
  Expired,
  FingerprintMismatch,
}

export enum ActivateDeviceResult {
  succeeded,
  notEnoughSeats,
  keyVerificationFailed,
  unableToVerify,
  connectionFailed,
}

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
