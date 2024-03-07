import React from "react";
import styles from "./styles.module.css";
import HomepageButton from "@site/src/components/HomepageButton";

const StartScreen = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.heading}>
        <div>
          <h1 className={styles.headingLabel}>
            <span>React Native</span>
            <span>IDE</span>
          </h1>
          <h2 className={styles.subheadingLabel}>
            A better developer experience for React Native developers.
          </h2>
        </div>
        <div>
          <HomepageButton
            href="https://marketplace.visualstudio.com/vscode"
            title="Download from VS Marketplace"
          />
        </div>
        <div className={styles.headingDisclaimer}>
          React Native IDE is only available for macOS.
        </div>
      </div>
    </section>
  );
};

export default StartScreen;
