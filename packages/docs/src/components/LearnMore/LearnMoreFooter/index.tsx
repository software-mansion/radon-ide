import React, { useEffect } from "react";
import styles from "./styles.module.css";
import { track } from "@vercel/analytics";
import DownloadButtons from "../../DownloadButtons";
import RadonIconGreen from "../../RadonIconGreen";
import usePageType from "@site/src/hooks/usePageType";
import clsx from "clsx";

const RADON_IDE_MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide";
const DEFAULT_INSTALLS_NO = "20,000+";

const LearnMoreFooter = () => {
  const handleBottomCTAClick = () => {
    track("Bottom CTA");
  };

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [installs, setInstalls] = React.useState(DEFAULT_INSTALLS_NO);
  const { isLanding } = usePageType();

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
    <div
      className={clsx(
        styles.learnMoreSectionFooter,
        isLoaded && styles.show,
        isLanding ? styles.sectionLanding : styles.sectionFeature
      )}>
      <div
        className={clsx(
          styles.contentContainer,
          isLanding ? styles.containerLanding : styles.containerFeature
        )}>
        <h2>
          Join <span>{installs} developers</span>
          <br /> using Radon IDE for faster,
          <br /> more efficient app development
        </h2>
        <div className={styles.buttonContainer}>
          <DownloadButtons />
        </div>
      </div>
      {isLanding && (
        <div className={styles.radonIconGreen}>
          <RadonIconGreen />
        </div>
      )}
    </div>
  );
};

export default LearnMoreFooter;
