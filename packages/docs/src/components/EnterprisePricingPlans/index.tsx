import React, { forwardRef } from "react";
import styles from "./styles.module.css";
import PricingPlansList from "../Pricing/PricingPlansList";
import { usePricingLogic } from "@site/src/hooks/usePricingLogic";

interface EnterprisePricingPlansProps {
  onFormScrollButtonClick: () => void;
}

const EnterprisePricingPlans = forwardRef<HTMLDivElement, EnterprisePricingPlansProps>(
  (props, ref) => {
    const { isMonthly, setIsMonthly, openBusinessCheckout, openIndividualCheckout } =
      usePricingLogic();

    return (
      <div ref={ref} className={styles.container}>
        <p className={styles.heading}>Enterprise plans tailored to your business</p>
        <p className={styles.subheading}>Choose the subscription plan tailored to your needs</p>
        <PricingPlansList
          handleBusiness={openBusinessCheckout}
          handleIndividual={openIndividualCheckout}
          handleCustom={props.onFormScrollButtonClick}
          isMonthly={isMonthly}
          setIsMonthly={setIsMonthly}
        />

        <div className={styles.pricingLink}>
          <p>Need to see all plan options? </p>
          <a href="/pricing">View complete pricing comparison</a>
        </div>
      </div>
    );
  }
);

export default EnterprisePricingPlans;
