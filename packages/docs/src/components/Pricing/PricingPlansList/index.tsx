import React, { useState } from "react";
import styles from "./styles.module.css";
import usePaddle from "@site/src/hooks/usePaddle";
import pricing from "../PricingCard/pricing.module.css";
import Button from "../../Button";
import PricingCard from "../PricingCard";

const isProduction = process.env.NODE_ENV === "production";

const INDIVIDUAL_MONTHLY_PRICE_ID = isProduction
  ? "pri_01hx944ht3wnpvgktatj6v5k4b"
  : "pri_01j0tjqzqhv6vezhf14pwtxfm0";
const INDIVIDUAL_YEARLY_PRICE_ID = isProduction
  ? "pri_01hzf02s579nwrwb756enh8r7g"
  : "pri_01jb1ajv7btj3cbnshrdq4ncjf";
const BUSINESS_MONTHLY_PRICE_ID = isProduction
  ? "pri_01jdyc0j8wkfqx3a7nbf6tsaxy"
  : "pri_01jdyap7jcydxvewmek2r0e35q";
const BUSINESS_YEARLY_PRICE_ID = isProduction
  ? "pri_01jdyc1z1nh3pgp01ya4h8g075"
  : "pri_01jdyaqnwf3w4pm6hsgwehm1by";

const PricingPlansList = () => {
  const paddle = usePaddle();
  const [isMonthly, setIsMonthly] = useState(true);

  const individual = isMonthly ? (
    <>
      $19 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/month excl. VAT </p>
    </>
  ) : (
    <>
      $190 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/year excl. VAT </p>
    </>
  );
  const business = isMonthly ? (
    <>
      $29 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/month excl. VAT </p>
    </>
  ) : (
    <>
      $290 <span className={pricing.plan__currency}>USD</span>
      <p className={pricing.plan__price_second_line}> per seat/year excl. VAT </p>
    </>
  );

  const openIndividualCheckout = () => {
    paddle?.Checkout.open({
      items: [
        {
          priceId: isMonthly ? INDIVIDUAL_MONTHLY_PRICE_ID : INDIVIDUAL_YEARLY_PRICE_ID,
          quantity: 1,
        },
      ],
    });
  };
  const openBusinessCheckout = () => {
    paddle?.Checkout.open({
      items: [
        { priceId: isMonthly ? BUSINESS_MONTHLY_PRICE_ID : BUSINESS_YEARLY_PRICE_ID, quantity: 1 },
      ],
    });
  };
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
          <h3 className={pricing.plan__price}>{individual}</h3>
          <p className={pricing.plan__tagline}>
            For individual developers and freelancers craving more enjoyable coding sessions.
          </p>
          <div className={pricing.plan__spacer} />
          <Button onClick={openIndividualCheckout}>Buy Individual</Button>
        </PricingCard>
        <PricingCard>
          <h2 className={pricing.plan__name}>Radon IDE Business</h2>
          <h3 className={pricing.plan__price}>{business}</h3>
          <p className={pricing.plan__tagline}>
            For companies seeking to drastically improve their developer experience.
          </p>
          <div className={pricing.plan__spacer} />
          <Button onClick={openBusinessCheckout}>Buy Business</Button>
        </PricingCard>
      </ul>
    </>
  );
};

export default PricingPlansList;
