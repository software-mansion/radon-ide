import React from "react";
import styles from "./styles.module.css";
import PricingPlansList from "./PricingPlansList";
import FAQ from "../Sections/FAQ";
import Admonition from "@site/src/theme/Admonition";
import Motivation from "../Motivation";

const Pricing = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.headingLabel}>Pricing</h1>
      <Admonition type="info">
        Right now, we are gathering the feedback and working on the stability of the product.
        <br />
        <br /> React Native IDE is{" "}
        <span className={styles.highlight}>completely free during the Beta period</span> which ends
        at the end of Q3 2024. Till this time the following pricing plans does not apply.
      </Admonition>
      <PricingPlansList />
      <Motivation />
      <FAQ />
    </div>
  );
};

export default Pricing;
