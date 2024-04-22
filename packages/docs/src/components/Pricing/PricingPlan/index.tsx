import React from "react";
import styles from "./styles.module.css";
import HomepageButton from "../../HomepageButton";

interface Props {
  name: string;
  price: string;
  features: string[];
  cta?: { text: string; href: string };
}

const PricingPlan = ({ name, price, features, cta }: Props) => {
  return (
    <div className={styles.plan__container}>
      <h3 className={styles.plan__name}>{name}</h3>
      <h4 className={styles.plan__price}>{price}</h4>
      <ul className={styles.plan__features}>
        {features.map((feature) => (
          <li>{feature}</li>
        ))}
      </ul>
      {cta && <HomepageButton href={cta.href} title={cta.text} />}
    </div>
  );
};

export default PricingPlan;
