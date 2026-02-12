import React from "react";
import styles from "./styles.module.css";
import clsx from "clsx";
import PricingCardLabel from "../PricingCard/PricingCardLabel";
import PricingButton from "../ComparePricingPlans/PricingButton";
import { PricingPlanCardProps, PlanType } from "../PricingPlansList";
import PricingFeaturesList from "../PricingPlansList/PricingFeaturesList";

interface PricingCardProps {
  planData?: PricingPlanCardProps;
  isMonthly?: boolean;
  href?: string;
  onButtonClick?: (planId: PlanType) => void;
  children?: React.ReactNode;
}

const PlanHeaders: Record<PlanType, string> = {
  FREE: "",
  PRO: "All the Free features, plus:",
  TEAM: "Development & Testing - All Pro features",
  ENTERPRISE: "All the Team features, plus:",
};

function PricingCard({ planData, isMonthly, href, onButtonClick, children }: PricingCardProps) {
  const { plan, stylingFilled, buttonLabel, featuresAll, featuresTeamManagement, featuresSupport } =
    planData;

  const isProPlan = plan === "PRO";
  const headerText = PlanHeaders[plan];

  return (
    <div className={isProPlan ? styles.proCardContainer : styles.pricingCardContainer}>
      <PricingCardLabel planData={planData} isMonthly={isMonthly}>
        <PricingButton
          stylingFilled={stylingFilled}
          onClick={() => onButtonClick(plan)}
          href={href}>
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
            <p>Support</p>
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
