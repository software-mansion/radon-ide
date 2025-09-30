import React from "react";
import styles from "./styles.module.css";
import clsx from "clsx";

interface TimePeriodProps {
  isMonthly: boolean;
  setIsMonthly: (value: boolean) => void;
}

export default function PricingPeriodButton({ isMonthly, setIsMonthly }: TimePeriodProps) {
  return (
    <div className={styles.container}>
      <button
        type="button"
        className={clsx(styles.btn, isMonthly ? styles.active : "")}
        onClick={() => setIsMonthly(true)}>
        <p>Monthly</p>
      </button>
      <button
        type="button"
        className={clsx(styles.btn, isMonthly ? "" : styles.active)}
        onClick={() => setIsMonthly(false)}>
        <p className={styles.yearlyContainer}>
          Yearly<span className={styles.plan_pay_annually__discount}>(Save 17%)</span>
        </p>
      </button>
    </div>
  );
}
