import React, { forwardRef } from "react";
import styles from "./styles.module.css";
import PricingPlansList from "../Pricing/PricingPlansList";
import PricingCard from "../Pricing/PricingCard";
import PlanLabelCard from "../Pricing/ComparePricingPlans/PlanLabelCard";

const EnterprisePricingPlans = forwardRef<HTMLDivElement, {}>((props, ref) => {
  return (
    <div ref={ref} className={styles.container}>
      <p className={styles.heading}>Enterprise plans tailored to your business</p>
      <p className={styles.subheading}>Choose the subscription plan tailored to your needs</p>
      <PricingPlansList />

      <div className={styles.pricingLink}>
        <p>Need to see all plan options? </p>
        <a href="/pricing">View complete pricing comparison</a>
      </div>
    </div>
  );
});

export default EnterprisePricingPlans;
