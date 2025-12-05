import { use$ } from "@legendapp/state/react";
import { Feature, FeatureAvailabilityStatus } from "../../common/License";
import { useStore } from "../providers/storeProvider";

export function useIsFeatureAdminDisabled(feature: Feature) {
  const store$ = useStore();
  const featuresAvailability = use$(store$.license.featuresAvailability);

  return featuresAvailability[feature] === FeatureAvailabilityStatus.ADMIN_DISABLED;
}
