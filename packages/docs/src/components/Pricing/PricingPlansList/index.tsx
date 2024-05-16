import React, { useState } from "react";
import styles from "./styles.module.css";
import Button from "../../Button";
import clsx from "clsx";

const PricingPlansList = () => {
  const [isAnnually, setIsAnnually] = useState(true);

  const monthly = (
    <>
      $9 <span className={styles.plan__price_second_line}> per month </span>
    </>
  );

  const annually = (
    <>
      <span className={styles.plan__price_strikethrough}>$9</span> $7.5{" "}
      <span className={styles.plan__price_second_line}> per month billed annually </span>
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
            <h3 className={styles.plan__price}>{isAnnually ? annually : monthly}</h3>
            <p className={styles.plan__tagline}>Support the development</p>
            <p>What's included:</p>
            <ul className={styles.plan__features}>
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
            <h2 className={styles.plan__name}>Enterprise</h2>
            <h3 className={styles.plan__price}>Get in touch</h3>
            <p className={styles.plan__tagline}>Become a partner</p>
            <p>What's included:</p>
            <ul className={styles.plan__features}>
              <li>Everything in Individual</li>
              <li>Priority support</li>
              <li>React Native Consulting services available</li>
            </ul>
            <div className={styles.plan__spacer} />
            <Button href="https://swmansion.com/contact#contact-form">Contact us</Button>
          </div>
        </li>
        <li>
          <div className={styles.plan__container}>
            <h2 className={styles.plan__name}>Educational</h2>
            <h3 className={styles.plan__price}>Free</h3>
            <p className={styles.plan__tagline}>Learn by doing</p>
            <p>Conditions apply:</p>
            <ul className={styles.plan__features}>
              <li>Everything in Individual</li>
              <li>For students from accredited educational institutions</li>
              <li>Only for non-commercial purposes</li>
            </ul>
            <div className={styles.plan__spacer} />
            <Button href="/" disabled>
              Choose
            </Button>
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
