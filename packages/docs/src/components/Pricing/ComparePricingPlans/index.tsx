import React from "react";
import styles from "./styles.module.css";
import CheckIcon from "../../CheckIcon";
import PlanLabelCard from "./PlanLabelCard";
import { useModal } from "../../ModalProvider";
import { PricingProps } from "..";
import clsx from "clsx";
import { planFeaturesData } from "./planFeaturesData";

export interface FeatureItem {
  label: string;
  free: string[] | boolean;
  pro: string[] | boolean;
  team: string[] | boolean;
  enterprise: string[] | boolean;
}

const handleCellContent = (data: string[] | boolean) => {
  if (Array.isArray(data)) {
    return data.map((element, idx) => <p key={idx}>{element}</p>);
  } else if (data === true) {
    return <CheckIcon />;
  } else {
    return <p className={styles.notIncluded}>—</p>;
  }
};

export default function ComparePricingPlans({ handleBusiness }: PricingProps) {
  const { onOpen } = useModal();
  const pricingPlanFeatures: FeatureItem[] = planFeaturesData;
  return (
    <div className={styles.tableDisplay}>
      <div className={styles.title}>Compare plans</div>
      <div className={styles.container}>
        <div className={styles.planColumns}>
          <div className={styles.columnName}>Features</div>
          <PlanLabelCard
            plan="FREE"
            monthlyPrice={0}
            buttonLabel="Download"
            stylingFilled={false}
            onClick={onOpen}
          />
          <PlanLabelCard
            plan="PRO"
            monthlyPrice={25}
            yearlyLowPrice={250}
            buttonLabel="Start 14-day trial"
            stylingFilled={true}
            onClick={handleBusiness}
          />
          <PlanLabelCard
            plan="TEAM"
            monthlyPrice={75}
            yearlyLowPrice={750}
            buttonLabel="Buy licenses"
            stylingFilled={true}
            href="mailto:projects@swmansion.com"
          />
          <PlanLabelCard
            plan="ENTERPRISE"
            monthlyPrice="Custom pricing"
            buttonLabel="Get your quote"
            stylingFilled={true}
            href="mailto:projects@swmansion.com"
          />
        </div>
        {pricingPlanFeatures.map((feature, index) => (
          <div
            key={index}
            className={clsx(
              styles.table,
              Array.isArray(feature.enterprise) && feature.enterprise.length > 1
                ? ""
                : styles.centered
            )}>
            <div className={styles.featureLabelCell}>{feature.label}</div>
            <div className={styles.valueCell}>{handleCellContent(feature.free)}</div>
            <div className={styles.valueCell}>{handleCellContent(feature.pro)}</div>
            <div className={styles.valueCell}>{handleCellContent(feature.team)}</div>
            <div className={styles.valueCell}>{handleCellContent(feature.enterprise)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
