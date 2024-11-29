import React from "react";
import styles from "./styles.module.css";
import PricingPlansList from "./PricingPlansList";
import FAQ from "../Sections/FAQ";
import Motivation from "../Motivation";
import { CompatibilityInfo } from "./CompatibilityInfo";

const Pricing = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.headingLabel}>Get a better developer experience in React Native.</h1>
      <h3 className={styles.subheadlingLabel}>
        Choose a plan that works for your needs. Pay monthly or yearly, and cancel anytime.
      </h3>
      <div className={styles.wrapper}>
        <PricingPlansList />
      </div>
      <CompatibilityInfo />
      <p>
        Radon IDE on Windows is in Beta and{" "}
        <span className={styles.highlight}>doesn't require making any purchase</span>. You can use
        Radon IDE on Windows with a free Beta license.
      </p>
      <Motivation />
      <FAQ />
    </div>
  );
};

export default Pricing;
