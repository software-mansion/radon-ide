import React, { useMemo, useState } from "react";
import styles from "./styles.module.css";
import { PricingProps } from "..";
import PricingPeriodButton from "./PricingPeriodButton";
import usePageType from "@site/src/hooks/usePageType";
import { pricingIndividualData } from "../pricingIndividualData";
import { pricingBusinessData } from "../pricingBusinessData";
import { useModal } from "../../ModalProvider";
import clsx from "clsx";
import PricingCard from "../PricingCard";

export interface FeatureProps {
  label: string;
  info: string;
}

export interface PricingPlanCardProps {
  plan: string;
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
  handleBusiness,
  handleIndividual,
  handleCustom,
  isMonthly,
  setIsMonthly,
}: PricingProps) => {
  const { isEnterprise } = usePageType();
  const [isIndividual, setIsIndividual] = useState(true);
  const { onOpen } = useModal();

  const currentPlans = useMemo(() => {
    if (isEnterprise) return pricingBusinessData;
    return isIndividual ? pricingIndividualData : pricingBusinessData;
  }, [isIndividual, isEnterprise]);

  const handlePlanButtonClick = (id: string) => {
    switch (id) {
      case "FREE":
        onOpen();
        break;
      case "PRO":
        handleIndividual();
        break;
      case "TEAM":
        handleBusiness();
        break;
      case "ENTERPRISE":
        handleCustom();
        break;
      default:
        return;
    }
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
              <p>For individuals</p>
            </button>
            <button
              type="button"
              className={clsx(styles.btn, isIndividual ? "" : styles.active)}
              onClick={() => setIsIndividual(false)}>
              <p>For organizations</p>
            </button>
          </div>
        )}
        <PricingPeriodButton isMonthly={isMonthly} setIsMonthly={setIsMonthly} />
      </div>
      <div className={styles.list}>
        {currentPlans.map((planData: PricingPlanCardProps) => (
          <PricingCard
            key={planData.plan}
            planData={planData}
            isMonthly={isMonthly}
            onButtonClick={handlePlanButtonClick}
          />
        ))}
      </div>
    </div>
  );
};

export default PricingPlansList;
