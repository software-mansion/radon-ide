import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";
import PricingCard from "../PricingCard";
import { PricingProps } from "..";
import PricingCardLabel from "../PricingCard/PricingCardLabel";
import PricingPeriodButton from "./PricingPeriodButton";
import usePageType from "@site/src/hooks/usePageType";
import { pricingIndividualData } from "./pricingIndividualData";
import { pricingBusinessData } from "./pricingBusinessData";
import PricingFeaturesList from "./PricingFeaturesList";

export interface FeatureProps {
  label: string;
  info: string;
}

export interface PricingCardProps {
  plan: string;
  price: {
    monthly: number | string;
    yearly: number | string;
  };
  yearlyFullPrice?: number | string;
  label: string;
  buttonLabel: string;
  stylingFilled: boolean;
  href?: string;
  featuresAll: FeatureProps[];
  featuresTeamManagement?: FeatureProps[];
  featuresSupport?: FeatureProps[];
}

const PricingPlansList = ({ handleBusiness }: PricingProps) => {
  const pricingCardsIndividual = pricingIndividualData;
  const pricingCardsBusiness = pricingBusinessData;
  const [isMonthly, setIsMonthly] = useState(true);
  const { isEnterprise } = usePageType();
  const [isIndividual, setIsIndividual] = useState(true);
  const [plan, setPlan] = useState<PricingCardProps[]>(pricingCardsIndividual);

  useEffect(() => {
    isIndividual ? setPlan(pricingCardsIndividual) : setPlan(pricingCardsBusiness);
    isEnterprise && setPlan(pricingCardsBusiness);
  }, [isIndividual, isEnterprise]);

  return (
    <>
      <div className={styles.plan_pay_annually}>
        {!isEnterprise && (
          <div className={styles.container}>
            <button
              type="button"
              className={isIndividual ? `${styles.btn} ${styles.active}` : styles.btn}
              onClick={() => setIsIndividual(true)}>
              <p>For individuals</p>
            </button>
            <button
              type="button"
              className={isIndividual ? styles.btn : `${styles.btn} ${styles.active}`}
              onClick={() => setIsIndividual(false)}>
              <p className={styles.yearlyContainer}>For businesses</p>
            </button>
          </div>
        )}
        <PricingPeriodButton isMonthly={isMonthly} setIsMonthly={setIsMonthly} />
      </div>
      <div className={styles.list}>
        {plan.map((el, idx) => (
          <PricingCard>
            <PricingCardLabel key={idx} plan={el} isMonthly={isMonthly} />
            <div className={styles.cardMiddle}>
              <PricingFeaturesList featuresList={el.featuresAll} />
              {el.featuresTeamManagement && (
                <>
                  {" "}
                  <p>Team Management</p>
                  <PricingFeaturesList featuresList={el.featuresTeamManagement} />
                </>
              )}
              {el.featuresSupport && (
                <>
                  {" "}
                  <p>Support & Updates</p>
                  <PricingFeaturesList featuresList={el.featuresSupport} />
                </>
              )}
            </div>
          </PricingCard>
        ))}
      </div>
    </>
  );
};

export default PricingPlansList;
