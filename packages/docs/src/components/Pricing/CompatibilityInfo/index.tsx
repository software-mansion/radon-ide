import React from "react";
import styles from "./styles.module.css";
import HomepageButton from "../../HomepageButton";

export function CompatibilityInfo() {
  return (
    <div className={styles.compatibilityInfoWrapper}>
      <p className={styles.compatibilityInfo}>
        Before making a purchase make sure to consult the compatibility page to see whether your
        project is officially supported by Radon IDE.
      </p>
      <HomepageButton href="/docs/getting-started/compatibility" title="See&nbsp;compatibility" />
    </div>
  );
}
