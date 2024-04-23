import React from "react";
import styles from "./styles.module.css";
import PricingPlansList from "./PricingPlansList";
import InfoIcon from "@site/static/img/info-circle.svg";

const Pricing = () => {
  return (
    <>
      <div>
        <h1 className={styles.headingLabel}>Pricing</h1>
        <div className={styles.headingDisclaimer}>
          <InfoIcon className={styles.headingDisclaimerIcon} />
          Pricing is not applied during beta period.
        </div>
      </div>
      <PricingPlansList />
    </>
  );
};

export default Pricing;
