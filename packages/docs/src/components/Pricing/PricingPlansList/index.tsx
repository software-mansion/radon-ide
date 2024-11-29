import React, { useState } from "react";
import styles from "./styles.module.css";
import pricing from "../PricingCard/pricing.module.css";
import Button from "../../Button";
import PricingCard from "../PricingCard";
import useBaseUrl from "@docusaurus/useBaseUrl";

const PricingPlansList = () => {
  const [isMonthly, setIsMonthly] = useState(true);

  const individualMonthly = (
    <>
      $19 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/month excl. VAT </p>
    </>
  );
  const individualAnnually = (
    <>
      $190 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/year excl. VAT </p>
    </>
  );
  const businessMonthly = (
    <>
      $29 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/month excl. VAT </p>
    </>
  );
  const businessAnnually = (
    <>
      $290 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/year excl. VAT </p>
    </>
  );
  return (
    <>
      <div className={styles.plan_pay_annually}>
        <p>Monthly</p>
        <label className={styles.toggleSwitch}>
          <input
            type="checkbox"
            checked={isMonthly}
            onChange={() => void setIsMonthly(!isMonthly)}
          />
          <div className={styles.toggleSwitchBackground}>
            <div className={styles.toggleSwitchHandle}></div>
          </div>
        </label>
        <p>
          Yearly <p className={styles.plan_pay_annually__discount}>(save 16%)</p>
        </p>
      </div>
      <ul className={styles.list}>
        <PricingCard>
          <h2 className={pricing.plan__name}>Radon IDE Individual</h2>
          <h3 className={pricing.plan__price}>
            {isMonthly ? individualMonthly : individualAnnually}
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
          <h3 className={pricing.plan__price}>{isMonthly ? businessMonthly : businessAnnually}</h3>
          <p className={pricing.plan__tagline}>
            For companies seeking to drastically improve their developer experience.
          </p>
          <div className={pricing.plan__spacer} />
          <Button href="https://swmansion.com/contact/projects" disabled>
            Available soon
          </Button>
        </PricingCard>
      </ul>
    </>
  );
};

export default PricingPlansList;
