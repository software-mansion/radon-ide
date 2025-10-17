import React, { useMemo, useState } from "react";
import styles from "./styles.module.css";
import { PricingProps } from "..";
import PricingPeriodButton from "./PricingPeriodButton";
import usePageType from "@site/src/hooks/usePageType";
import { pricingIndividualData } from "../pricingIndividualData";
import { pricingBusinessData } from "../pricingBusinessData";
import clsx from "clsx";
import PricingCard from "../PricingCard";

export type PlanType = "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

export interface FeatureProps {
  label: string;
  info?: string;
}

export interface PricingPlanCardProps {
  plan: PlanType;
  price: {
    monthly: number | string;
    yearly: number | string;
  };
  yearlyFullPrice?: number | string;
  label: string;
  buttonLabel: string;
  stylingFilled: boolean;
  featuresAll: FeatureProps[];
  featuresTeamManagement?: FeatureProps[];
  featuresSupport?: FeatureProps[];
}

const PricingPlansList = ({
  handleFree,
  handleTeam,
  handlePro,
  handleEnterprise,
  isMonthly,
  setIsMonthly,
}: PricingProps) => {
  const { isEnterprise } = usePageType();
  const [isIndividual, setIsIndividual] = useState(true);

  const currentPlans = useMemo(() => {
    if (isEnterprise) return pricingBusinessData;
    return isIndividual ? pricingIndividualData : pricingBusinessData;
  }, [isIndividual, isEnterprise]);

  const actions: Record<PlanType, () => void> = {
    FREE: handleFree,
    PRO: handlePro,
    TEAM: handleTeam,
    ENTERPRISE: handleEnterprise,
  };

  return (
    <div className={styles.planContainer}>
      <div className={clsx(styles.plan_pay_individual, isEnterprise ? styles.btnCenter : "")}>
        {!isEnterprise && (
          <div className={styles.planBtnContainer}>
            <button
              type="button"
              className={clsx(styles.btn, isIndividual ? styles.active : "")}
              onClick={() => setIsIndividual(true)}>
              For individuals
            </button>
            <button
              type="button"
              className={clsx(styles.btn, isIndividual ? "" : styles.active)}
              onClick={() => setIsIndividual(false)}>
              For organizations
            </button>
          </div>
        )}
        <PricingPeriodButton isMonthly={isMonthly} setIsMonthly={setIsMonthly} />
      </div>
      <div className={styles.list}>
        {currentPlans.map((planData) => (
          <PricingCard
            key={planData.plan}
            planData={planData}
            isMonthly={isMonthly}
            onButtonClick={(planId: PlanType) => actions[planId]?.()}
          />
        ))}
      </div>
    </div>
  );
};

export default PricingPlansList;
