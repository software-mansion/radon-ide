import React from "react";
import styles from "./styles.module.css";
import InfoIcon from "../InfoIcon";

interface TooltipProps {
  info: string;
}

export default function Tooltip({ info }: TooltipProps) {
  return (
    <div className={styles.tooltipBox}>
      <div className={styles.tooltip}>
        <InfoIcon />
        <div className={styles.tooltiptextContainer}>
          <p className={styles.tooltiptext}>{info}</p>
        </div>
      </div>
    </div>
  );
}
