import React from "react";
import styles from "./styles.module.css";
import PricingPlan from "../PricingPlan";

const plans = [
  {
    name: "Individual",
    price: "to be announced",
    features: ["basic features", "basic support", "basic limits"],
  },
  {
    name: "Team",
    price: "to be announced",
    features: ["pro features", "pro support", "pro limits"],
  },
  {
    name: "Enterprise",
    price: "custom",
    features: ["pro features", "unlimited support", "no limits"],
    cta: {
      text: "Contact sales",
      href: "mailto:projects@swmansion.com",
    },
  },
];

const PricingPlansList = () => {
  return (
    <ul className={styles.list}>
      {plans.map(({ name, price, features, cta }) => (
        <li className={styles.item}>
          <PricingPlan name={name} price={price} features={features} cta={cta} />
        </li>
      ))}
    </ul>
  );
};

export default PricingPlansList;
