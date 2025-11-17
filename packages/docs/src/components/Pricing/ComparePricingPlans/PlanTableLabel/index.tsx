import React from "react";
import styles from "./styles.module.css";
import PricingButton from "../PricingButton";
import { PlanType } from "../../PricingPlansList";

interface PlanTableLabelProps {
  plan: PlanType;
  monthlyPrice: number | string;
  yearlyLowPrice?: number;
  yearlyFullPrice?: number;
  buttonLabel: string;
  stylingFilled?: boolean;
  href?: string;
  onClick?: () => void;
}

export default function PlanTableLabel({
  plan,
  monthlyPrice,
  yearlyLowPrice,
  buttonLabel,
  stylingFilled,
  href,
  onClick,
}: PlanTableLabelProps) {
  return (
    <div className={styles.container}>
      <div className={styles.planDetails}>
        <div className={styles.planName}>{plan}</div>
        <div className={styles.priceDescription}>
          {typeof monthlyPrice == "number" ? (
            <>
              <span>${monthlyPrice}</span> /month{" "}
            </>
          ) : (
            <span>{monthlyPrice}</span>
          )}
          {yearlyLowPrice && (
            <>
              or <span>${yearlyLowPrice}</span> /year
            </>
          )}
        </div>
      </div>
      <PricingButton stylingFilled={stylingFilled} onClick={onClick} isTable={true} href={href}>
        {buttonLabel}
      </PricingButton>
    </div>
  );
}
