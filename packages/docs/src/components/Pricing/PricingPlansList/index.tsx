import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";
import PricingCard from "../PricingCard";
import { PricingProps } from "..";
import PricingCardLabel from "../PricingCard/PricingCardLabel";
import PricingPeriodButton from "./PricingPeriodButton";
import usePageType from "@site/src/hooks/usePageType";
import { pricingIndividualData } from "../pricingIndividualData";
import { pricingBusinessData } from "../pricingBusinessData";
import PricingFeaturesList from "./PricingFeaturesList";
import PricingButton from "../ComparePricingPlans/PricingButton";
import { useModal } from "../../ModalProvider";
import clsx from "clsx";

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
  isMonthly,
  setIsMonthly,
}: PricingProps) => {
  const pricingCardsIndividual = pricingIndividualData;
  const pricingCardsBusiness = pricingBusinessData;
  const { isEnterprise } = usePageType();
  const [isIndividual, setIsIndividual] = useState(true);
  const [plan, setPlan] = useState<PricingPlanCardProps[]>(pricingCardsIndividual);
  const { onOpen } = useModal();

  useEffect(() => {
    isIndividual ? setPlan(pricingCardsIndividual) : setPlan(pricingCardsBusiness);
    isEnterprise && setPlan(pricingCardsBusiness);
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
        onOpen();
        break;
      default:
        return null;
    }
  };

  const handleHeader = (planId: string) => {
    switch (planId) {
      case "PRO":
        return <p className={styles.headerDefault}>All the Free features, plus:</p>;
      case "TEAM":
        return <p className={styles.headerTeam}>Development & Testing - All Pro features</p>;
      case "ENTERPRISE":
        return <p className={styles.headerDefault}>All the Team features, plus:</p>;
      default:
        return null;
    }
  };

  return (
    <>
      <div className={clsx(styles.plan_pay_annually, isEnterprise ? styles.btnCenter : "")}>
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
              <p>For businesses</p>
            </button>
          </div>
        )}
        <PricingPeriodButton isMonthly={isMonthly} setIsMonthly={setIsMonthly} />
      </div>
      <div className={styles.list}>
        {plan.map((el, idx) => (
          <div
            className={el.plan === "PRO" ? styles.proCardContainer : styles.pricingCardContainer}
            key={idx}>
            <PricingCardLabel key={`${el.plan}_${idx}`} plan={el} isMonthly={isMonthly}>
              <PricingButton
                stylingFilled={el.stylingFilled}
                onClick={() => handlePlanButtonClick(el.plan)}>
                {el.buttonLabel}
              </PricingButton>
            </PricingCardLabel>
            <div className={clsx(styles.cardMain, el.plan === "PRO" ? styles.proCardBorder : "")}>
              <div className={styles.cardFeatures}>
                {handleHeader(el.plan)}
                <PricingFeaturesList featuresList={el.featuresAll} />
              </div>
              {el.featuresTeamManagement && (
                <div className={styles.cardFeatures}>
                  {" "}
                  <p>Team Management</p>
                  <PricingFeaturesList featuresList={el.featuresTeamManagement} />
                </div>
              )}
              {el.featuresSupport && (
                <div className={styles.cardFeatures}>
                  {" "}
                  <p>Support & Updates</p>
                  <PricingFeaturesList featuresList={el.featuresSupport} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default PricingPlansList;
