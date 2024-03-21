import React from "react";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import HomepageButton from "@site/src/components/HomepageButton";
import InfoIcon from "@site/static/img/info-circle.svg";
import { useWindowSize } from "@docusaurus/theme-common";

const StartScreen = () => {
  const windowSize = useWindowSize();

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroImageWrapper}>
          <img className={styles.heroImage} src={useBaseUrl("/img/hero.png")} draggable={false} />
        </div>
        <div className={styles.heading}>
          <div>
            <h1 className={styles.headingLabel}>
              <span>React Native</span>
              <span>IDE</span>
            </h1>
            <div className={styles.poweredBy}>
              <p>by</p>
              <a href="https://swmansion.com" target="_blank">
                <img
                  src={useBaseUrl("/img/swm-logo.svg")}
                  alt="Software Mansion"
                  className={styles.swmLogo}
                />
              </a>
            </div>
            <h2 className={styles.subheadingLabel}>
              A better developer experience for React Native developers.
            </h2>
          </div>
          <div className={styles.buttonContainer}>
            <HomepageButton
              target="_blank"
              href="https://forms.gle/URs4bsbkcvNJagzeA"
              title="Request Beta Access"
            />
          </div>
          <div className={styles.headingDisclaimer}>
            <InfoIcon className={styles.headingDisclaimerIcon} />
            We are currently testing the IDE with a limited number of users.
          </div>
        </div>
      </section>
    </>
  );
};

export default StartScreen;
