import React from "react";
import styles from "./styles.module.css";
import HomepageButton, { BorderStyling, ButtonStyling } from "../../HomepageButton";
import { track } from "@vercel/analytics";

export function CompatibilityInfo() {
  const handleCompatibilityClick = () => {
    track("See compatibility");
  };
  const handleTryOutClick = () => {
    track("[Pricing] Try out");
  };
  return (
    <div className={styles.compatibilityInfoWrapper}>
      <p className={styles.compatibilityInfo}>
        You can{" "}
        <a
          href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
          className={styles.link}
          target="_blank"
          onClick={handleTryOutClick}>
          try out Radon IDE
        </a>{" "}
        for 30 days before making a purchase. Also, consult the compatibility page to see whether
        your project is officially supported by Radon IDE.
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
