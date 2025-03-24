import React, { useEffect } from "react";
import HomepageButton, { ButtonStyling, BorderStyling } from "@site/src/components/HomepageButton";
import styles from "./styles.module.css";
import { track } from "@vercel/analytics";

const RADON_IDE_MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide";
const DEFAULT_INSTALLS_NO = "20,000+";

const LearnMoreFooter = () => {
  const handleBottomCTAClick = () => {
    track("Bottom CTA");
  };

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [installs, setInstalls] = React.useState(DEFAULT_INSTALLS_NO);

  useEffect(() => {
    async function getInstalls() {
      try {
        const response = await fetch(RADON_IDE_MARKETPLACE_URL);
        if (!response.ok) {
          throw new Error("Failed to fetch marketplace page");
        }

        const htmlString = await response.text();
        const regex =
          /<span class="installs-text" [^>]*>\s*\d{1,3}(?:,\d{3})*\s*installs\s*<\/span>/g;
        const match = htmlString.match(regex);
        const installsWithLabel = match[0].replace(/<\/?[^>]+(>|$)/g, "").trim();
        const installsWithoutLabel = installsWithLabel.replace(/installs/i, "").trim();
        setInstalls(installsWithoutLabel);
      } catch (err) {
        console.error(err);
        setInstalls(DEFAULT_INSTALLS_NO);
      } finally {
        setIsLoaded(true);
      }
    }
    getInstalls();
  }, []);

  return (
    <div className={`${styles.learnMoreSectionFooter} ${isLoaded ? styles.show : ""}`}>
      <div className={styles.ellipse} />
      <div className={styles.ellipse} />
      <div className={styles.contentContainer}>
        <h2>
          Join {installs} engineers using Radon IDE for faster, more efficient app development.
        </h2>
      </div>
      <HomepageButton
        href="/pricing"
        backgroundStyling={ButtonStyling.TO_WHITE}
        borderStyling={BorderStyling.NAVY}
        title="Try Radon IDE for Free"
        onClick={handleBottomCTAClick}
      />
    </div>
  );
};

export default LearnMoreFooter;
