import React from "react";
import styles from "./styles.module.css";
import PricingButton from "../../ComparePricingPlans/PricingButton";
import { PricingCardProps } from "../../PricingPlansList";

interface PricingCardLabelProps {
  plan: PricingCardProps;
  isMonthly: boolean;
  onClick?: () => void;
}

export default function PricingCardLabel({ plan, isMonthly, onClick }: PricingCardLabelProps) {
  const price = isMonthly ? plan.price.monthly : plan.price.yearly;
  return (
    <div className={styles.container}>
      <div className={styles.planDetails}>
        <div className={styles.planName}>{plan.plan}</div>
        <div className={styles.priceDescription}>
          {typeof price == "number" ? (
            <div className={styles.price}>
              <span>${price}</span>
              <div className={styles.period}>
                {!isMonthly && plan.yearlyFullPrice && (
                  <p className={styles.fullPrice}> ${plan.yearlyFullPrice}</p>
                )}
                <p>{isMonthly ? "/month" : "/year"} </p>
              </div>
            </div>
          ) : (
            <span>{price}</span>
          )}
        </div>
        <p className={styles.planLabel}>{plan.label}</p>
      </div>
      <PricingButton href={plan.href} stylingFilled={plan.stylingFilled} onClick={onClick}>
        {plan.buttonLabel}
      </PricingButton>
    </div>
  );
}
