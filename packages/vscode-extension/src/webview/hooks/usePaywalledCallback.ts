import { useCallback } from "react";
import { use$ } from "@legendapp/state/react";
import { useStore } from "../providers/storeProvider";
import { Feature, FeatureAvailabilityStatus, FeaturesAvailability } from "../../common/License";
import { usePaywall } from "./usePaywall";
import {
  AdminRestrictedFunctionalityError,
  PaywalledFunctionalityError,
} from "../../common/Errors";
import { useAdminBlock } from "./useAdminBlock";

function withPaywallGuard<F extends (...args: any[]) => Promise<void> | void>(
  fn: F,
  feature: Feature,
  featuresAvailability: FeaturesAvailability
): (...args: Parameters<F>) => Promise<void> {
  const { openPaywall } = usePaywall();
  const { openAdminBlock } = useAdminBlock();

  return async (...args: Parameters<F>): Promise<void> => {
    switch (featuresAvailability[feature]) {
      case FeatureAvailabilityStatus.AVAILABLE:
        break;
      case FeatureAvailabilityStatus.PAYWALLED:
        openPaywall({ feature });
        return;
      // Note: this should never happen as we disable Restricted functionalities but if a user finds a way
      // We inform them that restriction was placed by their administration.
      case FeatureAvailabilityStatus.ADMIN_DISABLED:
        openAdminBlock();
        return;
    }
    try {
      await fn(...args);
    } catch (e) {
      if (e instanceof PaywalledFunctionalityError) {
        openPaywall();
        return;
      }
      // Note: this should never happen as we disable Restricted functionalities but if a user finds a way
      // We inform them that restriction was placed by their administration.
      if (e instanceof AdminRestrictedFunctionalityError) {
        openAdminBlock();
        return;
      }
      throw e;
    }
  };
}

export function usePaywalledCallback<F extends (...args: any[]) => Promise<void> | void>(
  fn: F,
  feature: Feature,
  dependencies: unknown[]
) {
  const store$ = useStore();
  const featuresAvailability = use$(store$.license.featuresAvailability);

  return useCallback(withPaywallGuard(fn, feature, featuresAvailability), [
    featuresAvailability,
    ...dependencies,
  ]);
}
