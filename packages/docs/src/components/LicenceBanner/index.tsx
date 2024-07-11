import React from "react";
import HomepageButton, { ButtonStyling, BorderStyling } from "@site/src/components/HomepageButton";
import styles from "./styles.module.css";

const LicenceBanner = () => {
  return (
    <div className={styles.licenceContainer}>
      <div className={styles.elipse} />
      <div className={styles.elipse} />
      <div className={styles.contentContainer}>
        <h2>Supporter Licence is now available!</h2>
        <span>
          Get access to private Discord channel for feature requests and support and 50% discount on
          future Individual or Team license.
        </span>
      </div>
      <HomepageButton
        target="_blank"
        href="/pricing"
        backgroundStyling={ButtonStyling.TO_WHITE}
        borderStyling={BorderStyling.NAVY}
        title="Get the Licence"
      />
    </div>
  );
};

export default LicenceBanner;
