import React, { ReactNode } from "react";
import styles from "./styles.module.css";
import { PricingPlanCardProps } from "../../PricingPlansList";

interface PricingCardLabelProps {
  planData: PricingPlanCardProps;
  isMonthly: boolean;
  children: ReactNode;
}

export default function PricingCardLabel({ planData, isMonthly, children }: PricingCardLabelProps) {
  const { price, plan, label } = planData;
  const periodPrice = isMonthly ? price.monthly : price.yearlyPerMonth;
  const isProPlan = plan === "PRO";

  const perSeatText = plan === "TEAM" ? " per seat" : "";

  const showYearlyFullPrice = !isMonthly && price.yearlyPerMonth != 0;

  return (
    <div className={styles.container}>
      <div className={styles.planDetails}>
        <div className={isProPlan ? styles.planPro : styles.planName}>
          {plan}
          {isProPlan && (
            <div className={styles.popularBadge}>
              <p>Popular choice</p>
            </div>
          )}
        </div>

        <div className={styles.priceDescription}>
          {typeof periodPrice === "number" ? (
            <div className={styles.price}>
              <span>${periodPrice}</span>
              <div className={styles.period}>
                {showYearlyFullPrice && <p className={styles.fullPrice}>${price.monthly}</p>}
                <p>{`/month${perSeatText}${showYearlyFullPrice ? ", billed annually" : ""}`}</p>
              </div>
            </div>
          ) : (
            <span className={styles.customPrice}>{periodPrice}</span>
          )}
        </div>

        <p className={styles.planLabel}>{label}</p>
      </div>
      {isProPlan && <div className={styles.proGradient} />}
      {children}
    </div>
  );
}
