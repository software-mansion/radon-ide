import React from "react";
import styles from "./styles.module.css";
import HomepageButton from "@site/src/components/HomepageButton";

const LearnMoreFooter = () => {
  return (
    <section>
      <div className={styles.learnMoreSectionFooter}>
        <div>
          <p>Learn more about the Radon IDE features announced at App.js 2024</p>
        </div>
        <HomepageButton
          target="_blank"
          href="https://www.youtube.com/watch?v=HWGssA55oNc"
          title="See the video"
        />
      </div>
    </section>
  );
};

export default LearnMoreFooter;
