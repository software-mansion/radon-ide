import React from "react";
import styles from "./styles.module.css";
import PricingButton from "../PricingButton";

interface PlanLabelCardProps {
  plan: string;
  monthlyPrice: number;
  yearlyLowPrice?: number;
  yearlyFullPrice?: number;
  buttonLabel: string;
  stylingFilled?: boolean;
  href?: string;
  onClick?: () => void;
}

export default function PlanLabelCard({
  plan,
  monthlyPrice,
  yearlyLowPrice,
  buttonLabel,
  stylingFilled,
  href,
  onClick,
}: PlanLabelCardProps) {
  return (
    <div className={styles.container}>
      <div className={styles.planDetails}>
        <div className={styles.planName}>{plan}</div>
        <div className={styles.priceDescription}>
          {plan === "ENTERPRISE" ? "From " : ""}
          <span>${monthlyPrice}</span> /month{" "}
          {yearlyLowPrice && (
            <>
              or <span>${yearlyLowPrice}</span> /yearly
            </>
          )}
        </div>
      </div>
      <PricingButton href={href} stylingFilled={stylingFilled} onClick={onClick}>
        {buttonLabel}
      </PricingButton>
    </div>
  );
}
