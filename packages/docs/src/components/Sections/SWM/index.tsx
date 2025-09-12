import React from "react";
import styles from "./styles.module.css";
import MultipleSWMIcon from "../../MultipleSWMIcon";
import SWMIcon from "../../SWMIcon";

export default function SWM() {
  return (
    <div className={styles.boxBorder}>
      <div className={styles.container}>
        <div className={styles.textContainer}>
          <h2 className={styles.heading}>
            <span>Radon IDE </span>is built by Software Mansion
          </h2>
          <p className={styles.textContent}>
            We are core React Native contributors & creators and maintainers of key React Native
            libraries like Reanimated, Gesture Handler, or Screens.
          </p>
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
