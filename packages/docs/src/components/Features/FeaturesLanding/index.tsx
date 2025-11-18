import React from "react";
import styles from "./styles.module.css";
import ArrowRightSmallIcon from "../../ArrowRightSmallIcon";
import FeaturesGrid from "../FeaturesGrid";

export default function FeaturesLanding() {
  return (
    <div className={styles.contentContainer}>
      <div className={styles.textContent}>
        <h2 className={styles.heading}>
          Everything you need in one <span>React Native IDE</span>
        </h2>{" "}
        <div className={styles.description}>
          <p>
            Discover the power of Radon. Designed for React Native and Expo, it helps you write
            cleaner code, catch errors instantly, and focus on what matters most — building great
            apps.
          </p>
          <a href="/features" className={styles.learnMoreLink}>
            See all features <ArrowRightSmallIcon />
          </a>
        </div>
      </div>
      <div className={styles.overviewContainer}>
        <FeaturesGrid />
        <a href="/features" className={styles.learnMoreLinkBottom}>
          See all features <ArrowRightSmallIcon />
        </a>
      </div>
    </div>
  );
}
