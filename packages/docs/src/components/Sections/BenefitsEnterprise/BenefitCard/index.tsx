import React from "react";
import styles from "./styles.module.css";

interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function BenefitCard({ icon, title, description }: BenefitCardProps) {
  return (
    <div className={styles.cardContainer}>
      <div>{icon}</div>
      <div className={styles.textContent}>
        <div>
          <h5 className={styles.cardTitle}>{title}</h5>
        </div>
        <div>
          <p className={styles.description}>{description}</p>
        </div>
      </div>
    </div>
  );
}
