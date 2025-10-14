// #region License Helpers

export function hasAccessToProFeatures(licenseStatus: LicenseStatus) {
  return (
    licenseStatus === LicenseStatus.Pro ||
    licenseStatus === LicenseStatus.Team ||
    licenseStatus === LicenseStatus.Enterprise
  );
}

// #endregion License Helpers

// #region License State\

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
