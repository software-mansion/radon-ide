import React, { useState } from "react";
import styles from "./styles.module.css";
import CheckIcon from "@site/src/components/CheckIcon";
import { FeatureProps } from "..";
import Tooltip from "@site/src/components/Tooltip";

interface PricingFeaturesListProps {
  featuresList: FeatureProps[];
  plan?: string;
}

export default function PricingFeaturesList({ featuresList, plan }: PricingFeaturesListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleFeaturesLimit = 7;
  const isExpandable = plan === "TEAM" && featuresList.length >= visibleFeaturesLimit + 1;

  const handleExpanding = () => {
    setIsExpanded((prev) => !prev);
  };

  function visibleFeatures() {
    if (!isExpandable || isExpanded) {
      return featuresList;
    }
    return featuresList.slice(0, visibleFeaturesLimit);
  }

  return (
    <>
      {visibleFeatures().map((feature, idx) => (
        <div key={idx} className={styles.featureElement}>
          <CheckIcon />
          {feature.label}
          {feature.info !== "" && <Tooltip info={feature.info} />}
        </div>
      ))}

      {isExpandable && (
        <button type="button" onClick={handleExpanding}>
          {isExpanded ? "Show fever features" : "Show all features"}
        </button>
      )}
    </>
  );
}
