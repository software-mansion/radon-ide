import React, { useRef } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { onOpen } = useModal();
  const pricingPlanFeatures: FeatureItem[] = planFeaturesData;
  return (
    <div>
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
            monthlyPrice={39}
            yearlyLowPrice={390}
            buttonLabel="Start 14-day trial"
            stylingFilled={true}
            onClick={handleBusiness}
          />
          <PlanLabelCard
            plan="ENTERPRISE"
            monthlyPrice={99}
            yearlyLowPrice={990}
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
            <div className={styles.valueCell}>{handleCellContent(feature.enterprise)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
