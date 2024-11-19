import React from "react";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import HomepageButton from "@site/src/components/HomepageButton";
import InfoIcon from "@site/static/img/info-circle.svg";
import { motion } from "motion/react";

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
            {"An IDE for React Native".split(" ").map((word, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}>
                {word}
              </motion.span>
            ))}
          </h1>
          <motion.h2
            className={styles.subheadingLabel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}>
            Radon IDE is VSCode extension that turns your editor into a fully fledged IDE for React
            Native and Expo.
          </motion.h2>
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
        </div>
        <div className={styles.buttonContainer}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}>
            <HomepageButton
              target="_blank"
              href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
              title="Download from VSCode marketplace"
            />
          </motion.div>
        </div>
        <div className={styles.headingDisclaimer}>
          <InfoIcon className={styles.headingDisclaimerIcon} />
          Works with VSCode 1.86+ and Cursor 0.32 on macOS and Windows
        </div>
      </div>
    </section>
  );
};

export default StartScreen;
