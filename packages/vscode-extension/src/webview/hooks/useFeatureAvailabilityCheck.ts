import { use$ } from "@legendapp/state/react";
import { Feature, FeatureAvailabilityStatus } from "../../common/License";
import { useStore } from "../providers/storeProvider";

export function useIsFeatureAdminDisabled(feature: Feature) {
  const store$ = useStore();
  const featuresAvailability = use$(store$.license.featuresAvailability);

  return featuresAvailability[feature] === FeatureAvailabilityStatus.ADMIN_DISABLED;
}

export function useIsFeaturePaywalled(feature: Feature | undefined): boolean {
  const store$ = useStore();
  const featuresAvailability = use$(store$.license.featuresAvailability);
  if (!featuresAvailability || !feature) {
    return false;
  }
  return featuresAvailability[feature] === FeatureAvailabilityStatus.PAYWALLED;
}
