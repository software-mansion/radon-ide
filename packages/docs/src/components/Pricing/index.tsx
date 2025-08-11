import React from "react";
import styles from "./styles.module.css";
import PricingPlansList from "./PricingPlansList";
import FAQ from "../Sections/FAQ";
import clsx from "clsx";

const Pricing = () => {
  return (
    <div className={clsx(styles.container, "border-layout")}>
      <div className={styles.titleContainer}>
        <h1 className={styles.headingLabel}>Pricing</h1>
        <h3 className={styles.subheadlingLabel}>
          Choose a plan that works for your needs. <br /> Pay monthly for flexibility or yearly for
          the best price.
        </h3>
      </div>
      <div className={styles.wrapper}>
        <PricingPlansList />
      </div>
      <FAQ />
    </div>
  );
};

export default Pricing;
