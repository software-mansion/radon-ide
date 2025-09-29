import React from "react";
import styles from "./styles.module.css";
import CheckIcon from "@site/src/components/CheckIcon";
import { FeatureProps } from "..";

interface PricingFeaturesListProps {
  featuresList: FeatureProps[];
}

export default function PricingFeaturesList({ featuresList }: PricingFeaturesListProps) {
  return (
    <>
      {featuresList.map((feature, idx) => (
        <div key={idx} className={styles.featureElements}>
          <CheckIcon />
          {feature.label}
        </div>
      ))}
    </>
  );
}
