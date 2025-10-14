import React, { ReactNode } from "react";
import styles from "./styles.module.css";
import { PricingPlanCardProps } from "../../PricingPlansList";

interface PricingCardLabelProps {
  planData: PricingPlanCardProps;
  isMonthly: boolean;
  children: ReactNode;
}

export default function PricingCardLabel({ planData, isMonthly, children }: PricingCardLabelProps) {
  const price = isMonthly ? planData.price.monthly : planData.price.yearly;
  const isProPlan = planData.plan === "PRO";
  const isTeamPlan = planData.plan === "TEAM";

  const perSeatText = isTeamPlan ? "per seat" : "";
  const periodText = isMonthly ? `/month ${perSeatText}` : `/year ${perSeatText}`;
  const isCustomPrice = typeof price !== "number";

  const showYearlyFullPrice = !isMonthly && planData.yearlyFullPrice;

  return (
    <div className={styles.container}>
      <div className={styles.planDetails}>
        {isProPlan ? (
          <div className={styles.planPro}>
            {planData.plan}
            <div className={styles.popularBadge}>
              <p>Popular choice</p>
            </div>
          </div>
        ) : (
          <div className={styles.planName}>{planData.plan}</div>
        )}

        <div className={styles.priceDescription}>
          {!isCustomPrice ? (
            <div className={styles.price}>
              <span>${price}</span>
              <div className={styles.period}>
                {showYearlyFullPrice && (
                  <p className={styles.fullPrice}> ${planData.yearlyFullPrice}</p>
                )}
                <p>{periodText} </p>
              </div>
            </div>
          ) : (
            <span className={styles.customPrice}>{price}</span>
          )}
        </div>
        <p className={styles.planLabel}>{planData.label}</p>
      </div>
      {isProPlan && <div className={styles.proGradient} />}
      {children}
    </div>
  );
}
