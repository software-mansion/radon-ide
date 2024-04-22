import React from "react";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import PricingPlansList from "./PricingPlansList";

const Pricing = () => {
  return (
    <div>
      <div className={styles.heading}>
        <h1 className={styles.headingLabel}>Pricing</h1>
        <div className={styles.poweredBy}>
          <p>by</p>
          <a href="https://swmansion.com" target="_blank">
            <img
              src={useBaseUrl("/img/swm-logo.svg")}
              alt="Software Mansion"
              className={styles.swmLogo}
            />
          </a>
        </div>
      </div>
      <h2 className={styles.subheadingLabel}>Pricing is not applied during beta period.</h2>
      <PricingPlansList />
    </div>
  );
};

export default Pricing;
