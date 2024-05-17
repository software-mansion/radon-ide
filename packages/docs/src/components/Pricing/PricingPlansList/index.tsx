import React, { useState } from "react";
import styles from "./styles.module.css";
import Button from "../../Button";
import clsx from "clsx";

const PricingPlansList = () => {
  const [isAnnually, setIsAnnually] = useState(true);

  const individualMonthly = (
    <>
      $9 <span className={styles.plan__currency}>USD</span>
      <span className={styles.plan__price_second_line}> per person/month </span>
    </>
  );
  const individualAnnually = (
    <>
      $90 <span className={styles.plan__currency}>USD</span>{" "}
      <span className={styles.plan__price_second_line}>per person/year </span>
    </>
  );
  const supporterMonthly = (
    <>
      $6 <span className={styles.plan__currency}>USD</span>{" "}
      <span className={styles.plan__price_second_line}>per person/month </span>
    </>
  );
  const supporterAnnually = (
    <>
      $72 <span className={styles.plan__currency}>USD</span>{" "}
      <span className={styles.plan__price_second_line}>per person/year </span>
    </>
  );
  return (
    <>
      <div className={styles.plan_pay_annually}>
        <p>Yearly</p>
        <label className={styles.toggleSwitch}>
          <input
            type="checkbox"
            checked={isAnnually}
            onChange={() => void setIsAnnually(!isAnnually)}
          />
          <div className={styles.toggleSwitchBackground}>
            <div className={styles.toggleSwitchHandle}></div>
          </div>
        </label>
        <p>Monthly</p>
      </div>
      <ul className={styles.list}>
        <li className={styles.item}>
          <div className={styles.plan__container}>
            <h2 className={styles.plan__name}>Individual</h2>
            <h3 className={styles.plan__price}>
              {isAnnually ? individualAnnually : individualMonthly}
            </h3>
            <p className={styles.plan__tagline}>
              billed {isAnnually ? "yearly, two months free" : "monthly"}
            </p>
            <p>What's included:</p>
            <ul className={styles.plan__features}>
              <li>Support the development of IDE</li>
              <li>Put breakpoints right in the VSCode</li>
              <li>Develop components in isolation</li>
              <li>Expo Router & React Navigation integration</li>
              <li>Get support through official Software Mansion channels</li>
            </ul>
            <div className={styles.plan__spacer} />

            <Button href="/" disabled>
              Choose
            </Button>
          </div>
        </li>
        <li className={styles.item}>
          <div className={clsx(styles.plan__container, styles.plan__highlight)}>
            <h2 className={styles.plan__name}>Supporter</h2>
            <h3 className={styles.plan__price}>
              {isAnnually ? supporterAnnually : supporterMonthly}
            </h3>
            <p className={styles.plan__tagline}>one-time payment for a year</p>
            <p>What's included:</p>
            <ul className={styles.plan__features}>
              <li>Everything in Individual</li>
              <li>One-time offer only available during Beta</li>
              <li>Lock in a lower price</li>
              <li>Next billing a full year after the release</li>
            </ul>
            <div className={styles.plan__spacer} />
            <Button href="/" disabled>
              Choose
            </Button>
          </div>
        </li>

        <li className={styles.item}>
          <div className={styles.plan__container}>
            <h2 className={styles.plan__name}>Enterprise</h2>
            <h3 className={styles.plan__price}>Get in touch</h3>
            <p className={styles.plan__tagline}>
              <a href="https://swmansion.com/contact#contact-form">Contact us</a> for pricing
              estimates
            </p>
            <p>What's included:</p>
            <ul className={styles.plan__features}>
              <li>Everything in Individual</li>
              <li>Priority support</li>
              <li>React Native Consulting services available</li>
            </ul>
            <div className={styles.plan__spacer} />
            <Button href="https://swmansion.com/contact#contact-form">Contact Sales</Button>
          </div>
        </li>
      </ul>
      <p>
        Disclaimer: The following pricing is for informational purposes only and may change in the
        future.
      </p>
    </>
  );
};

export default PricingPlansList;
