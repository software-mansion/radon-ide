import React from "react";
import styles from "./styles.module.css";
import pricing from "../PricingCard/pricing.module.css";
import Button from "../../Button";
import PricingCard from "../PricingCard";
import useBaseUrl from "@docusaurus/useBaseUrl";

const PricingPlansList = () => {
  return (
    <ul className={styles.list}>
      <PricingCard>
        <h2 className={pricing.plan__name}>Radon IDE Individual</h2>
        <h3 className={pricing.plan__price}>
          $19 <span className={pricing.plan__currency}>USD</span>
          <p className={pricing.plan__price_second_line}> per seat/month excl. VAT </p>
        </h3>
        <p className={pricing.plan__tagline}>
          For individual developers and freelancers craving more enjoyable coding sessions.
        </p>
        <div className={pricing.plan__spacer} />
        <Button href="/" disabled>
          Available soon
        </Button>
      </PricingCard>
      <PricingCard>
        <h2 className={pricing.plan__name}>Radon IDE Business</h2>
        <h3 className={pricing.plan__price}>
          $29 <span className={pricing.plan__currency}>USD</span>
          <p className={pricing.plan__price_second_line}> per seat/month excl. VAT </p>
        </h3>
        <p className={pricing.plan__tagline}>
          For companies seeking to drastically improve their developer experience.
        </p>
        <div className={pricing.plan__spacer} />
        <Button href="https://swmansion.com/contact/projects" disabled>
          Available soon
        </Button>
      </PricingCard>
    </ul>
  );
};

export default PricingPlansList;
