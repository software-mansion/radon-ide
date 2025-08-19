import React from "react";
import styles from "./styles.module.css";
import ReactNativeIcon from "../ReactNativeIcon";
import ExpoIcon from "../ExpoIcon";
import FillPattern from "../FillPattern";

export default function Features() {
  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <div className={styles.radonText}>
          <p>
            <span>Radon IDE</span> helps you build better apps, faster.
          </p>
        </div>
        <div className={styles.spacer}></div>
      </div>
      <div className={styles.right}>
        <div className={styles.buildForContainer}>
          <div className={styles.pattern}>
            <FillPattern />
          </div>
          <div className={styles.buildFor}>BUILT FOR</div>
        </div>
        <div className={styles.iconContainer}>
          <div className={styles.reactNativeIcon}>
            <ReactNativeIcon />
          </div>
          <div className={styles.expoIcon}>
            <ExpoIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
