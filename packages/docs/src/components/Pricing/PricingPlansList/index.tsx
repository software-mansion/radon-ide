import React, { useState } from "react";
import styles from "./styles.module.css";
import usePaddle from "@site/src/hooks/usePaddle";
import pricing from "../PricingCard/pricing.module.css";
import Button from "../../Button";
import PricingCard from "../PricingCard";
import { clsx } from "clsx";
import { PricingProps } from "..";

const PricingPlansList = ({ handleBusiness, handleIndividual }: PricingProps) => {
  const [isMonthly, setIsMonthly] = useState(true);

  const individual = isMonthly ? (
    <>
      $19 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/month (excl. VAT) </p>
    </>
  ) : (
    <>
      $190 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/year (excl. VAT) </p>
    </>
  );
  const business = isMonthly ? (
    <>
      $29 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/month (excl. VAT) </p>
    </>
  ) : (
    <>
      $290 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/year (excl. VAT) </p>
    </>
  );

  const enterprise = (
    <>
      Custom
      <p className={clsx(pricing.plan__price_second_line, pricing.plan__price_second_line_hidden)}>
        .
      </p>
    </>
  );

  return (
    <>
      <div className={styles.plan_pay_annually}>
        <div className={styles.container}>
          <button
            type="button"
            className={isMonthly ? `${styles.btn} ${styles.active}` : styles.btn}
            onClick={() => setIsMonthly(true)}>
            <p>Monthly</p>
          </button>
          <button
            type="button"
            className={isMonthly ? styles.btn : `${styles.btn} ${styles.active}`}
            onClick={() => setIsMonthly(false)}>
            <p className={styles.yearlyContainer}>
              Yearly<span className={styles.plan_pay_annually__discount}>(Save 16%)</span>
            </p>
          </button>
        </div>
      </div>
      <ul className={styles.list}>
        <PricingCard>
          <div className={pricing.cardHeader}>
            <h2 className={pricing.plan__name}>Radon&nbsp;IDE&nbsp;Individual</h2>
            <h3 className={pricing.plan__price}>{individual}</h3>
          </div>
          <div className={pricing.cardMiddle}>
            <p className={pricing.plan__tagline}>
              For individual developers and freelancers craving more enjoyable coding sessions.
            </p>
          </div>
          <div className={pricing.cardButton}>
            <Button onClick={handleIndividual}>Buy Individual</Button>
          </div>
        </PricingCard>
        <PricingCard>
          <div className={pricing.cardHeader}>
            <h2 className={pricing.plan__name}>Radon&nbsp;IDE&nbsp;Business</h2>
            <h3 className={pricing.plan__price}>{business}</h3>
          </div>
          <div className={pricing.cardMiddle}>
            <p className={pricing.plan__tagline}>
              For companies seeking to drastically improve their developer experience.
            </p>
          </div>
          <div className={pricing.cardButton}>
            <Button onClick={handleBusiness}>Buy Business</Button>
          </div>
        </PricingCard>
        <PricingCard>
          <div className={pricing.cardHeader}>
            <h2 className={pricing.plan__name}>Radon&nbsp;IDE&nbsp;Enterprise</h2>
            <h3 className={pricing.plan__price}>{enterprise}</h3>
          </div>
          <div className={pricing.cardMiddle}>
            <p className={pricing.plan__tagline}>
              For organizations that need custom contract options, pricing plans, and support.
            </p>
          </div>
          <div className={pricing.cardButton}>
            <Button href="mailto:projects@swmansion.com">Contact Us</Button>
          </div>
        </PricingCard>
      </ul>
    </>
  );
};

export default PricingPlansList;
