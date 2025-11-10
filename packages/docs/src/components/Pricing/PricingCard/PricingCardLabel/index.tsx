import React, { ReactNode } from "react";
import styles from "./styles.module.css";
import { PricingPlanCardProps } from "../../PricingPlansList";

interface PricingCardLabelProps {
  planData: PricingPlanCardProps;
  isMonthly: boolean;
  children: ReactNode;
}

export default function PricingCardLabel({ planData, isMonthly, children }: PricingCardLabelProps) {
  const { price, plan, label, yearlyFullPrice } = planData;
  const periodPrice = isMonthly ? price.monthly : price.yearly;
  const isProPlan = plan === "PRO";

  const perSeatText = plan === "TEAM" ? "per seat" : "";
  const periodText = isMonthly ? `/month ` : `/year `;

  const showYearlyFullPrice = !isMonthly && yearlyFullPrice;

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
                {showYearlyFullPrice && <p className={styles.fullPrice}>${yearlyFullPrice}</p>}
                <p>{`${periodText}${perSeatText}`}</p>
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
