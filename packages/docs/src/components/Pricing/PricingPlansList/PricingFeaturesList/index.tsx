import React from "react";
import styles from "./styles.module.css";
import CheckIcon from "@site/src/components/CheckIcon";
import { FeatureProps } from "..";
import Tooltip from "@site/src/components/Tooltip";

interface PricingFeaturesListProps {
  featuresList: FeatureProps[];
}

export default function PricingFeaturesList({ featuresList }: PricingFeaturesListProps) {
  return (
    <>
      {featuresList.map((feature, idx) => (
        <div key={idx} className={styles.featureElement}>
          <CheckIcon />
          {feature.label}
          {feature.info !== "" && <Tooltip info={feature.info} />}
        </div>
      ))}
    </>
  );
}
