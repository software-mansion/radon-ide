import React from "react";
import styles from "./styles.module.css";
import HomepageButton from "@site/src/components/HomepageButton";
import { track } from "@vercel/analytics";

const LearnMoreFooter = () => {
  const handleBottomCTAClick = () => {
    track("Bottom CTA");
  };

  return (
    <section>
      <div className={styles.learnMoreSectionFooter}>
        <div>
          <p>Hundreds of engineers are building better apps with Radon IDE right now.</p>
        </div>
        <HomepageButton
          target="_blank"
          href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
          title="Try Radon IDE free"
          onClick={handleBottomCTAClick}
        />
      </div>
    </section>
  );
};

export default LearnMoreFooter;
