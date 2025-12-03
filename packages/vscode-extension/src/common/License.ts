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
  AppSwitcherButton = "AppSwitcherButton",
  Biometrics = "Biometrics",
  ComponentPreview = "ComponentPreview",
  Debugger = "Debugger",
  DeviceAppearanceSettings = "DeviceAppearanceSettings",
  DeviceFontSizeSettings = "DeviceFontSizeSettings",
  DeviceLocalizationSettings = "DeviceLocalizationSettings",
  DeviceRotation = "DeviceRotation",
  ElementInspector = "ElementInspector",
  ExpoRouterIntegration = "ExpoRouterIntegration",
  HomeButton = "HomeButton",
  IOSSmartphoneSimulators = "IOSSmartphoneSimulators",
  IOSTabletSimulators = "IOSTabletSimulators",
  JSLogging = "JSLogging",
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
  VolumeButtons = "VolumeButtons",
}

// #endregion Features

// #region Default Features Availability

export const DefaultFeaturesAvailability = {
  [Feature.AndroidSmartphoneEmulators]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.AndroidTabletEmulators]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.AndroidPhysicalDevice]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.AppSwitcherButton]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.Biometrics]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.ComponentPreview]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.Debugger]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.DeviceAppearanceSettings]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.DeviceFontSizeSettings]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.DeviceLocalizationSettings]: FeatureAvailabilityStatus.PAYWALLED,
  // FRYTKI - this is changed only for testing
  [Feature.DeviceRotation]: FeatureAvailabilityStatus.ADMIN_DISABLED,
  [Feature.ElementInspector]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.ExpoRouterIntegration]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.HomeButton]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.IOSSmartphoneSimulators]: FeatureAvailabilityStatus.AVAILABLE,
  [Feature.IOSTabletSimulators]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.JSLogging]: FeatureAvailabilityStatus.AVAILABLE,
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
  // Frytki
  [Feature.SendFile]: FeatureAvailabilityStatus.ADMIN_DISABLED,
  [Feature.StorybookIntegration]: FeatureAvailabilityStatus.PAYWALLED,
  [Feature.VolumeButtons]: FeatureAvailabilityStatus.AVAILABLE,
};

// #endregion Feature By License
