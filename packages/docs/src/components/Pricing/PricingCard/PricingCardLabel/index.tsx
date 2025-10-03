import React, { ReactNode } from "react";
import styles from "./styles.module.css";
import { PricingPlanCardProps } from "../../PricingPlansList";

interface PricingCardLabelProps {
  plan: PricingPlanCardProps;
  isMonthly: boolean;
  children: ReactNode;
}

export default function PricingCardLabel({ plan, isMonthly, children }: PricingCardLabelProps) {
  const price = isMonthly ? plan.price.monthly : plan.price.yearly;
  const isProPlan = plan.plan === "PRO";
  const isTeamPlan = plan.plan === "TEAM";

  const perSeatText = isTeamPlan ? "per seat" : "";
  const periodText = isMonthly ? `/month ${perSeatText}` : `/year ${perSeatText}`;
  const isCustomPrice = typeof price !== "number";

  const showYearlyFullPrice = !isMonthly && plan.yearlyFullPrice;

  return (
    <div className={styles.container}>
      <div className={styles.planDetails}>
        {isProPlan ? (
          <div className={styles.planPro}>
            {plan.plan}
            <div className={styles.popularBadge}>
              <p>Popular choice</p>
            </div>
          </div>
        ) : (
          <div className={styles.planName}>{plan.plan}</div>
        )}

        <div className={styles.priceDescription}>
          {!isCustomPrice ? (
            <div className={styles.price}>
              <span>${price}</span>
              <div className={styles.period}>
                {showYearlyFullPrice && (
                  <p className={styles.fullPrice}> ${plan.yearlyFullPrice}</p>
                )}
                <p>{periodText} </p>
              </div>
            </div>
          ) : (
            <span className={styles.customPrice}>{price}</span>
          )}
        </div>
        <p className={styles.planLabel}>{plan.label}</p>
      </div>
      {isProPlan && <div className={styles.proGradient} />}
      {children}
    </div>
  );
}
