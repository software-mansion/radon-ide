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
  const isTEAM = plan.plan === "TEAM" ? "per seat" : "";
  return (
    <div className={styles.container}>
      <div className={styles.planDetails}>
        {plan.plan === "PRO" ? (
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
          {typeof price == "number" ? (
            <div className={styles.price}>
              <span>${price}</span>
              <div className={styles.period}>
                {!isMonthly && plan.yearlyFullPrice && (
                  <p className={styles.fullPrice}> ${plan.yearlyFullPrice}</p>
                )}
                <p>{isMonthly ? `/month ${isTEAM}` : `/year ${isTEAM}`} </p>
              </div>
            </div>
          ) : (
            <span className={styles.customPrice}>{price}</span>
          )}
        </div>
        <p className={styles.planLabel}>{plan.label}</p>
      </div>
      {plan.plan === "PRO" && <div className={styles.proGradient} />}
      {children}
    </div>
  );
}
