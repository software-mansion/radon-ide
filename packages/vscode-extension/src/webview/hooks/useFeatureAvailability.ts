import { use$ } from "@legendapp/state/react";
import { Feature, FeatureAvailabilityStatus } from "../../common/License";
import { useStore } from "../providers/storeProvider";

export function useFeatureAvailability(feature: Feature): FeatureAvailabilityStatus {
  const store$ = useStore();
  const featuresAvailability = use$(store$.license.featuresAvailability);
  return featuresAvailability[feature];
}
