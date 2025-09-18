import React from "react";
import styles from "./styles.module.css";
import PricingPlansList from "../Pricing/PricingPlansList";

export default function EnterprisePricingPlans() {
  return (
    <div className={styles.container}>
      <p className={styles.heading}>Enterprise plans tailored to your business</p>
      <PricingPlansList />
      <div className={styles.pricingLink}>
        <p>Need to see all plan options? </p>
        <a href="/pricing">View complete pricing comparison</a>
      </div>
    </div>
  );
}
