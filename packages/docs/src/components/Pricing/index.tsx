import React, { useState } from "react";
import styles from "./styles.module.css";
import PricingPlansList from "./PricingPlansList";
import FAQ from "../Sections/FAQ";
import clsx from "clsx";
import ComparePricingPlans from "./ComparePricingPlans";
import usePaddle from "@site/src/hooks/usePaddle";

export interface PricingProps {
  handleIndividual?: () => void;
  handleBusiness?: () => void;
}

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

const Pricing = ({ handleBusiness, handleIndividual }: PricingProps) => {
  const paddle = usePaddle();

  const [isMonthly, setIsMonthly] = useState(true);
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
    <div className={clsx(styles.container, "border-layout")}>
      <div className={styles.titleContainer}>
        <h1 className={styles.headingLabel}>Pricing</h1>
        <h3 className={styles.subheadlingLabel}>
          Choose a plan that works for your needs. <br /> Pay monthly for flexibility or yearly for
          the best price.
        </h3>
      </div>
      <div className={styles.wrapper}>
        <PricingPlansList
          handleBusiness={openBusinessCheckout}
          handleIndividual={openIndividualCheckout}
        />
      </div>
      <ComparePricingPlans handleBusiness={openBusinessCheckout} />
      <FAQ />
    </div>
  );
};

export default Pricing;
