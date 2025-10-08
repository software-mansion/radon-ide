import React from "react";
import styles from "./styles.module.css";
import clsx from "clsx";
import PricingCardLabel from "../PricingCard/PricingCardLabel";
import PricingButton from "../ComparePricingPlans/PricingButton";
import { PricingPlanCardProps } from "../PricingPlansList";
import PricingFeaturesList from "../PricingPlansList/PricingFeaturesList";

interface PricingCardProps {
  planData?: PricingPlanCardProps;
  isMonthly?: boolean;
  onButtonClick?: (planId: string) => void;
  children?: React.ReactNode;
  bold?: boolean;
}

const PlanHeaders = {
  PRO: "All the Free features, plus:",
  TEAM: "Development & Testing - All Pro features",
  ENTERPRISE: "All the Team features, plus:",
};

function PricingCard({ planData, isMonthly, onButtonClick, children, bold }: PricingCardProps) {
  const { plan, stylingFilled, buttonLabel, featuresAll, featuresTeamManagement, featuresSupport } =
    planData;

  const isProPlan = plan === "PRO";
  const headerText = PlanHeaders[plan];

  return (
    <div className={isProPlan ? styles.proCardContainer : styles.pricingCardContainer}>
      <PricingCardLabel plan={planData} isMonthly={isMonthly}>
        <PricingButton stylingFilled={stylingFilled} onClick={() => onButtonClick(plan)}>
          {buttonLabel}
        </PricingButton>
      </PricingCardLabel>
      <div className={clsx(styles.cardMain, isProPlan && styles.proCardBorder)}>
        <div className={styles.cardFeatures}>
          {headerText && <p>{headerText}</p>}
          <PricingFeaturesList featuresList={featuresAll} plan={plan} />
        </div>
        {featuresSupport && (
          <div className={styles.cardFeatures}>
            <p>Support & Updates</p>
            <PricingFeaturesList featuresList={featuresSupport} />
          </div>
        )}
        {featuresTeamManagement && (
          <div className={styles.cardFeatures}>
            <p>Team Management</p>
            <PricingFeaturesList featuresList={featuresTeamManagement} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export default PricingCard;
