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
      return ProFeatures.union(FreeFeatures).has(feature)
        ? FeatureAvailabilityStatus.Available
        : FeatureAvailabilityStatus.InsufficientLicense;
    case LicenseStatus.Team:
      return TeamFeatures.union(ProFeatures).union(FreeFeatures).has(feature)
        ? FeatureAvailabilityStatus.Available
        : FeatureAvailabilityStatus.InsufficientLicense;
    case LicenseStatus.Enterprise:
      return EnterpriseFeatures.union(TeamFeatures)
        .union(ProFeatures)
        .union(FreeFeatures)
        .has(feature)
        ? FeatureAvailabilityStatus.Available
        : FeatureAvailabilityStatus.InsufficientLicense;
    default:
      return FeatureAvailabilityStatus.InsufficientLicense;
  }
}

export function getLicensesForFeature(feature: Feature) {
  const licenses = [];
  if (
    getFeatureAvailabilityStatus(LicenseStatus.Free, feature) ===
    FeatureAvailabilityStatus.Available
  ) {
    licenses.push(LicenseStatus.Free);
  }
  if (
    getFeatureAvailabilityStatus(LicenseStatus.Pro, feature) === FeatureAvailabilityStatus.Available
  ) {
    licenses.push(LicenseStatus.Pro);
  }
  if (
    getFeatureAvailabilityStatus(LicenseStatus.Team, feature) ===
    FeatureAvailabilityStatus.Available
  ) {
    licenses.push(LicenseStatus.Team);
  }
  if (
    getFeatureAvailabilityStatus(LicenseStatus.Enterprise, feature) ===
    FeatureAvailabilityStatus.Available
  ) {
    licenses.push(LicenseStatus.Enterprise);
  }
  return licenses;
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

// #endregion License State

// #region Features

export enum Feature {
  AndroidSmartphoneEmulators,
  AndroidTabletEmulators,
  AppSwitcherButton,
  Biometrics,
  ComponentPreview,
  Debugger,
  DeviceAppearanceSettings,
  DeviceFontSizeSettings,
  DeviceLocalizationSettings,
  DeviceRotation,
  ElementInspector,
  ExpoRouterIntegration,
  HomeButton,
  IOSSmartphoneSimulators,
  IOSTabletSimulators,
  JSLogging,
  JSProfiler,
  LocationSimulation,
  NetworkInspection,
  OpenDeepLink,
  OutlineRenders,
  Permissions,
  ReactProfiler,
  ReactQueryDevTools,
  RadonConnect,
  RadonAI,
  ReduxDevTools,
  ScreenRecording,
  ScreenReplay,
  Screenshot,
  SendFile,
  StorybookIntegration,
  VolumeButtons,
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
]);

export const TeamFeatures: Set<Feature> = new Set<Feature>([]);

export const EnterpriseFeatures: Set<Feature> = new Set<Feature>([]);

// #endregion Feature By License
