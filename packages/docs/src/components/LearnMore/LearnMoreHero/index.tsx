import React from "react";
import styles from "./styles.module.css";
import HomeButton from "@site/src/components/DownloadButtons/HomeButton";
import Elipse from "@site/src/components/Elipse";

const LearnMoreHero = () => {
  return (
    <section>
      <div className={styles.elipseContainer}>
        <Elipse isSmall className={styles.elipse} />
        <Elipse size={300} className={styles.elipse} />
      </div>
      <div className={styles.learnMoreSectionHero}>
        <p>Learn more about Software Mansion</p>
        <HomeButton target="_blank" href="https://swmansion.com/" title="See our website" />
      </div>
    </section>
  );
};

export default LearnMoreHero;
