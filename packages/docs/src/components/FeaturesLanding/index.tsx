import React from "react";
import LandingBanner from "./LandingBanner";
import FeatureSliderLanding from "./FeatureSliderLanding";
import FeaturesGrid from "./FeaturesGrid";

export default function FeaturesLanding() {
  return (
    <div>
      <LandingBanner />
      <FeatureSliderLanding />
      <FeaturesGrid />
    </div>
  );
}
