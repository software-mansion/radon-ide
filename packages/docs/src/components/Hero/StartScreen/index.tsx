import React from "react";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import HomepageButton from "@site/src/components/HomepageButton";
import InfoIcon from "@site/static/img/info-circle.svg";

const StartScreen = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.heroImageContainer}>
        <div className={styles.heroImageWrapper}>
          <img className={styles.heroImage} src={useBaseUrl("/img/hero.png")} draggable={false} />
        </div>
      </div>
      <div className={styles.heading}>
        <div>
          <h1 className={styles.headingLabel}>
            <span>React Native</span>
            <span>IDE</span>
            <span className={styles.betaChip}>BETA</span>
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
            href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
            title="Download from VSCode marketplace"
          />
        </div>
      </div>
    </section>
  );
};

export default StartScreen;
