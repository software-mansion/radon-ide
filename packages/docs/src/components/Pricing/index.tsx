import React from "react";
import styles from "./styles.module.css";
import PricingPlansList from "./PricingPlansList";
import FAQ from "../Sections/FAQ";
import Motivation from "../Motivation";
import { CompatibilityInfo } from "./CompatibilityInfo";

const Pricing = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.headingLabel}>Get the best developer experience in React Native.</h1>
      <h3 className={styles.subheadlingLabel}>
        Choose a plan that works for your needs. Pay monthly for flexibility or yearly for the best
        price.
      </h3>
      <div className={styles.wrapper}>
        <PricingPlansList />
      </div>
      <CompatibilityInfo />
      <p>
        Windows users can use beta version of Radon IDE for Windows which is available under{" "}
        <a href="https://ide.swmansion.com/legal" target="_blank" className={styles.highlight}>
          free beta license
        </a>
        .
      </p>
      <Motivation />
      <FAQ />
    </div>
  );
};

export default Pricing;
