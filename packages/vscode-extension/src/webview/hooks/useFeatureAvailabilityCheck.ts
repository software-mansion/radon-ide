import { use$ } from "@legendapp/state/react";
import { Feature, FeatureAvailabilityStatus } from "../../common/License";
import { useStore } from "../providers/storeProvider";

function useFeaturesAvailability() {
  const store$ = useStore();
  return use$(store$.license.featuresAvailability);
}

export function useIsFeatureAdminDisabled(feature: Feature | undefined): boolean {
  const featuresAvailability = useFeaturesAvailability();
  return !!feature && featuresAvailability[feature] === FeatureAvailabilityStatus.ADMIN_DISABLED;
}

export function useIsFeaturePaywalled(feature: Feature | undefined): boolean {
  const featuresAvailability = useFeaturesAvailability();
  return !!feature && featuresAvailability[feature] === FeatureAvailabilityStatus.PAYWALLED;
}

export function useIsFeatureAvailable(feature: Feature | undefined): boolean {
  const featuresAvailability = useFeaturesAvailability();
  return !!feature && featuresAvailability[feature] === FeatureAvailabilityStatus.AVAILABLE;
}
