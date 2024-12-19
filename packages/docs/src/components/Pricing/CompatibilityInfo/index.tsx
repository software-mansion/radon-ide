import React from "react";
import styles from "./styles.module.css";
import HomepageButton, { BorderStyling, ButtonStyling } from "../../HomepageButton";
import { track } from "@vercel/analytics";

export function CompatibilityInfo() {
  const handleCompatibilityClick = () => {
    track("See compatibility");
  };
  return (
    <div className={styles.compatibilityInfoWrapper}>
      <p className={styles.compatibilityInfo}>
        Before making a purchase make sure to consult the compatibility page to see whether your
        project is officially supported by Radon IDE.
      </p>
      <HomepageButton
        href="/docs/getting-started/compatibility"
        title="See&nbsp;compatibility"
        backgroundStyling={ButtonStyling.TO_WHITE}
        borderStyling={BorderStyling.NAVY}
        onClick={handleCompatibilityClick}
      />
    </div>
  );
}
