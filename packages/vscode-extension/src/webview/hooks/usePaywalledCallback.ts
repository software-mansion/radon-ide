import { use$ } from "@legendapp/state/react";
import { useStore } from "../providers/storeProvider";
import { useCallback } from "react";
import {
  Feature,
  FeatureAvailabilityStatus,
  getFeatureAvailabilityStatus,
  LicenseStatus,
} from "../../common/License";
import { usePaywall } from "./usePaywall";
import { RestrictedFunctionalityError } from "../../common/Errors";

function withPaywallGuard(
  fn: (...args: any[]) => any,
  feature: Feature,
  licenseStatus: LicenseStatus
) {
  const { openPaywall } = usePaywall();

  return async (...args: any[]) => {
    const featureAvailability = getFeatureAvailabilityStatus(licenseStatus, feature);
    switch (featureAvailability) {
      case FeatureAvailabilityStatus.Available:
        break;
      case FeatureAvailabilityStatus.InsufficientLicense:
        openPaywall();
        return;
    }
    try {
      await fn(...args);
    } catch (e) {
      if (e instanceof RestrictedFunctionalityError) {
        openPaywall();
        return;
      }
      throw e;
    }
  };
}

export function usePaywalledCallback(
  fn: (...args: any[]) => any,
  feature: Feature,
  dependencies: unknown[]
) {
  const store$ = useStore();
  const licenseStatus = use$(store$.license.status);
  return useCallback(withPaywallGuard(fn, feature, licenseStatus), [
    licenseStatus,
    ...dependencies,
  ]);
}
