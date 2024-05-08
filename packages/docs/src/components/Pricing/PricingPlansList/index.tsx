import React from "react";
import styles from "./styles.module.css";
import PricingPlan from "../PricingPlan";

const plans = [
  {
    name: "Educational",
    price: "Free",
    features: ["basic features", "basic support", "basic limits"],
  },
  {
    name: "Individual",
    price: "$9/month/seat",
    features: ["pro features", "pro support", "pro limits"],
  },
  {
    name: "Enterprise",
    features: ["pro features", "unlimited support", "no limits"],
    cta: {
      text: "Contact us",
      href: "mailto:contact@swmansion.com",
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
