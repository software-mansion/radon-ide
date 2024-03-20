import React from "react";
import styles from "./styles.module.css";
import HomepageButton from "@site/src/components/HomepageButton";
import { ButtonStyling, BorderStyling } from "@site/src/components/HomepageButton";
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
        <HomepageButton
          target="_blank"
          href="https://swmansion.com/"
          backgroundStyling={ButtonStyling.TO_NAVY}
          borderStyling={BorderStyling.NAVY}
          title="See our website"
        />
      </div>
    </section>
  );
};

export default LearnMoreHero;
