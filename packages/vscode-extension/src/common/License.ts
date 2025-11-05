// #region License Helpers
export enum FeatureAvailabilityStatus {
  Available,
  InsufficientLicense,
}

export function getFeatureAvailabilityStatus(
  licenseStatus: LicenseStatus,
  feature: Feature
): FeatureAvailabilityStatus {
  switch (licenseStatus) {
    case LicenseStatus.Inactive:
    case LicenseStatus.Free:
      return FreeFeatures.has(feature)
        ? FeatureAvailabilityStatus.Available
        : FeatureAvailabilityStatus.InsufficientLicense;
    case LicenseStatus.Pro:
      return ProFeatures.has(feature)
        ? FeatureAvailabilityStatus.Available
        : FeatureAvailabilityStatus.InsufficientLicense;
    case LicenseStatus.Team:
      return TeamFeatures.has(feature)
        ? FeatureAvailabilityStatus.Available
        : FeatureAvailabilityStatus.InsufficientLicense;
    case LicenseStatus.Enterprise:
      return EnterpriseFeatures.has(feature)
        ? FeatureAvailabilityStatus.Available
        : FeatureAvailabilityStatus.InsufficientLicense;
    default:
      return FeatureAvailabilityStatus.InsufficientLicense;
  }
}

export function getLicensesForFeature(feature: Feature) {
  const hasAccess = (license: LicenseStatus) =>
    getFeatureAvailabilityStatus(license, feature) === FeatureAvailabilityStatus.Available;
  const licenses = [
    LicenseStatus.Free,
    LicenseStatus.Pro,
    LicenseStatus.Team,
    LicenseStatus.Enterprise,
  ];
  return licenses.filter(hasAccess);
}

// #endregion License Helpers

// #region License State

export type LicenseState = {
  status: LicenseStatus;
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

// #region Feature By License

export const FreeFeatures: Set<Feature> = new Set<Feature>([
  Feature.AndroidSmartphoneEmulators,
  Feature.AppSwitcherButton,
  Feature.ComponentPreview,
  Feature.Debugger,
  Feature.DeviceAppearanceSettings,
  Feature.DeviceFontSizeSettings,
  Feature.ElementInspector,
  Feature.ExpoRouterIntegration,
  Feature.HomeButton,
  Feature.IOSSmartphoneSimulators,
  Feature.JSLogging,
  Feature.JSProfiler,
  Feature.NetworkInspection,
  Feature.OpenDeepLink,
  Feature.OutlineRenders,
  Feature.ReactProfiler,
  Feature.ReactQueryDevTools,
  Feature.RadonConnect,
  Feature.ReduxDevTools,
  Feature.VolumeButtons,
]);

export const ProFeatures: Set<Feature> = new Set<Feature>([
  Feature.AndroidTabletEmulators,
  Feature.AndroidPhysicalDevice,
  Feature.Biometrics,
  Feature.DeviceLocalizationSettings,
  Feature.DeviceRotation,
  Feature.IOSTabletSimulators,
  Feature.LocationSimulation,
  Feature.Permissions,
  Feature.RadonAI,
  Feature.ScreenRecording,
  Feature.ScreenReplay,
  Feature.Screenshot,
  Feature.SendFile,
  Feature.StorybookIntegration,
  ...FreeFeatures,
]);

export const TeamFeatures: Set<Feature> = new Set<Feature>([...ProFeatures]);

export const EnterpriseFeatures: Set<Feature> = new Set<Feature>([...TeamFeatures]);

// #endregion Feature By License
