import React from "react";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import HomepageButton from "@site/src/components/HomepageButton";
import InfoIcon from "@site/static/img/info-circle.svg";
import { motion } from "motion/react";
import { track } from "@vercel/analytics";

const StartScreen = () => {
  const handleCTAClick = () => {
    track("Main CTA");
  };

  return (
    <section className={styles.hero}>
      <motion.div
        className={styles.heroImageContainer}
        initial={{ x: 16 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5 }}>
        <div className={styles.heroImageWrapper}>
          <img className={styles.heroImage} src={useBaseUrl("/img/hero.png")} draggable={false} />
        </div>
      </motion.div>
      <div className={styles.heading}>
        <motion.div
          className={styles.poweredBy}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}>
          <img src={useBaseUrl("/img/logo.svg")} alt="Radon IDE logo" className={styles.logo} />
          <p>by</p>
          <a href="https://swmansion.com" target="_blank" className={styles.swmLogoWrapper}>
            <img
              src={useBaseUrl("/img/swm-logo.svg")}
              alt="Software Mansion"
              className={styles.swmLogo}
            />
          </a>
        </motion.div>
        <motion.h1
          className={styles.headingLabel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>
          An <span>IDE</span> for&nbsp;React Native
          <motion.div
            initial={{ x: 0, opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 1, 0], x: 500 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className={styles.headingSwoosh}
          />
        </motion.h1>
        <motion.h2
          className={styles.subheadingLabel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          Radon IDE is a VSCode and Cursor extension that turns your editor into a fully featured IDE for React
          Native and Expo.
        </motion.h2>
        <div className={styles.buttonContainer}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}>
            <HomepageButton
              target="_blank"
              href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
              title="Download from VSCode marketplace"
              onClick={handleCTAClick}
            />
          </motion.div>
        </div>
        <motion.div
          className={styles.headingDisclaimer}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}>
          <InfoIcon className={styles.headingDisclaimerIcon} />
          Works with VSCode 1.86+ and Cursor 0.32 on macOS and Windows
        </motion.div>
      </div>
    </section>
  );
};

export default StartScreen;
