import React from "react";
import styles from "./styles.module.css";
import MultipleSWMIcon from "../../MultipleSWMIcon";
import SWMIcon from "../../SWMIcon";

export default function SWM({ children }) {
  return (
    <div className={styles.boxBorder}>
      <div className={styles.container}>
        <div className={styles.textContainer}>
          <h2 className={styles.heading}>
            <span>Radon IDE </span>is built by Software Mansion
          </h2>
          <p className={styles.textContent}>{children}</p>
          <a href="https://swmansion.com/" target="_blank" className={styles.learnMoreButton}>
            Learn more About Us
          </a>
        </div>
        <div className={styles.box}>
          <div className={styles.swmMultipleIconContainer}>
            <MultipleSWMIcon />
          </div>
          <div className={styles.swmIconContainer}>
            <SWMIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
