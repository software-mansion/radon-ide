// #region License Helpers

export enum FeatureAvailabilityStatus {
  AVAILABLE = "AVAILABLE",
  PAYWALLED = "PAYWALLED",
  ADMIN_DISABLED = "ADMIN_DISABLED",
}

// #endregion License Helpers

// #region License State

export type FeaturesAvailability = { [F in Feature]: FeatureAvailabilityStatus };

export type LicenseState = {
  status: LicenseStatus;
  featuresAvailability: FeaturesAvailability;
  planName?: string;
};

export enum LicenseStatus {
  Inactive = "inactive",
  Free = "free",
  Pro = "pro",
  Team = "team",
  Enterprise = "enterprise",
}

export function getLicenseStatusFromString(str: string): LicenseStatus {
  const normalizedStr = str.toLowerCase() as LicenseStatus;

  if (Object.values(LicenseStatus).includes(normalizedStr)) {
    return normalizedStr;
  }

  return LicenseStatus.Inactive;
}

// #endregion License State

// #region Features

export enum Feature {
  AndroidSmartphoneEmulators = "AndroidSmartphoneEmulators",
  AndroidTabletEmulators = "AndroidTabletEmulators",
  AndroidPhysicalDevice = "AndroidPhysicalDevice",
  Biometrics = "Biometrics",
  ComponentPreview = "ComponentPreview",
  DeviceAppearanceSettings = "DeviceAppearanceSettings",
  DeviceFontSizeSettings = "DeviceFontSizeSettings",
  DeviceLocalizationSettings = "DeviceLocalizationSettings",
  DeviceRotation = "DeviceRotation",
  ElementInspector = "ElementInspector",
  ExpoRouterIntegration = "ExpoRouterIntegration",
  IOSSmartphoneSimulators = "IOSSmartphoneSimulators",
  IOSTabletSimulators = "IOSTabletSimulators",
  JSProfiler = "JSProfiler",
  LocationSimulation = "LocationSimulation",
  NetworkInspection = "NetworkInspection",
  OpenDeepLink = "OpenDeepLink",
  OutlineRenders = "OutlineRenders",
  Permissions = "Permissions",
  ReactProfiler = "ReactProfiler",
  ReactQueryDevTools = "ReactQueryDevTools",
  RadonConnect = "RadonConnect",
  RadonAI = "RadonAI",
  ReduxDevTools = "ReduxDevTools",
  ScreenRecording = "ScreenRecording",
  ScreenReplay = "ScreenReplay",
  Screenshot = "Screenshot",
  SendFile = "SendFile",
  StorybookIntegration = "StorybookIntegration",
}

// #endregion Features

// #region Default Features Availability

export const DefaultFeaturesAvailability = {
  [Feature.AndroidSmartphoneEmulators]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.AndroidTabletEmulators]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.AndroidPhysicalDevice]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.Biometrics]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.ComponentPreview]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.DeviceAppearanceSettings]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.DeviceFontSizeSettings]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.DeviceLocalizationSettings]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.DeviceRotation]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.ElementInspector]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.ExpoRouterIntegration]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.IOSSmartphoneSimulators]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.IOSTabletSimulators]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.JSProfiler]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.LocationSimulation]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.NetworkInspection]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.OpenDeepLink]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.OutlineRenders]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.Permissions]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.ReactProfiler]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.ReactQueryDevTools]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.RadonConnect]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.RadonAI]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.ReduxDevTools]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.ScreenRecording]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.ScreenReplay]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.Screenshot]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.SendFile]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.StorybookIntegration]: FeatureAvailabilityStatus.PAYWALLED,
};

// #endregion Feature By License
