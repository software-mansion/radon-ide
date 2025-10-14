import React, { useState } from "react";
import styles from "./styles.module.css";
import CheckIcon from "@site/src/components/CheckIcon";
import { FeatureProps, PlanType } from "..";
import Tooltip from "@site/src/components/Tooltip";
import ChevronDownIcon from "@site/src/components/ChevronDownIcon";
import clsx from "clsx";

const VISIBLE_FEATURES_LIMIT = 7;

interface PricingFeaturesListProps {
  featuresList: FeatureProps[];
  plan?: PlanType;
}

export default function PricingFeaturesList({ featuresList, plan }: PricingFeaturesListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandable = plan === "TEAM" && featuresList.length >= VISIBLE_FEATURES_LIMIT + 1;

  const handleExpanding = () => {
    setIsExpanded((prev) => !prev);
  };

  function visibleFeatures() {
    if (!isExpandable || isExpanded) {
      return featuresList;
    }
    return featuresList.slice(0, VISIBLE_FEATURES_LIMIT);
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
        <button type="button" className={styles.expandButton} onClick={handleExpanding}>
          <p className={styles.expandBtnLabel}>
            {isExpanded ? "Show fewer features" : "Show all features"}
          </p>
          <div className={clsx(styles.chevronIcon, isExpanded ? styles.chevronRotate : "")}>
            <ChevronDownIcon />
          </div>
        </button>
      )}
    </>
  );
}
