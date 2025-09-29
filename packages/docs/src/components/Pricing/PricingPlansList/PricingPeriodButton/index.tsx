import React from "react";
import styles from "./styles.module.css";

interface TimePeriodProps {
  isMonthly: boolean;
  setIsMonthly: (value: boolean) => void;
}

export default function PricingPeriodButton({ isMonthly, setIsMonthly }: TimePeriodProps) {
  return (
    <div className={styles.container}>
      <button
        type="button"
        className={isMonthly ? `${styles.btn} ${styles.active}` : styles.btn}
        onClick={() => setIsMonthly(true)}>
        <p>Monthly</p>
      </button>
      <button
        type="button"
        className={isMonthly ? styles.btn : `${styles.btn} ${styles.active}`}
        onClick={() => setIsMonthly(false)}>
        <p className={styles.yearlyContainer}>
          Yearly<span className={styles.plan_pay_annually__discount}>(Save 17%)</span>
        </p>
      </button>
    </div>
  );
}
