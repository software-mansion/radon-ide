import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";
import DownloadButtons from "../../DownloadButtons";
import RadonIconGreen from "../../RadonIconGreen";
import usePageType from "@site/src/hooks/usePageType";
import clsx from "clsx";

const RADON_IDE_MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide";
const RADON_IDE_OPEN_VSX_API = "https://open-vsx.org/api/swmansion/react-native-ide";
const DEFAULT_INSTALLS_NO = "34,000+";

const LearnMoreFooter = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [summaryInstalls, setSummaryInstalls] = useState<string | number>(DEFAULT_INSTALLS_NO);
  const { isLanding } = usePageType();
  const trackFrom = isLanding ? "Landing bottom" : "Features bottom";

  useEffect(() => {
    async function fetchData() {
      try {
        const marketplaceResponse = await fetch(RADON_IDE_MARKETPLACE_URL);
        let installsCount = 0;
        if (marketplaceResponse.ok) {
          const htmlString = await marketplaceResponse.text();
          const regex = /<span class="installs-text"[^>]*>\s*([\d,]+)\s*installs\s*<\/span>/i;
          const match = htmlString.match(regex);
          if (match) installsCount = parseInt(match[1].replace(/,/g, ""));
        }

        const openvsxResponse = await fetch(RADON_IDE_OPEN_VSX_API);
        let downloadsCount = 0;
        if (openvsxResponse.ok) {
          const data = await openvsxResponse.json();
          downloadsCount = parseInt(data.downloadCount ?? 0);
        }

        const sum = installsCount + downloadsCount;
        if (marketplaceResponse.ok && openvsxResponse.ok) {
          setSummaryInstalls(sum.toLocaleString("en-US"));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoaded(true);
      }
    }

    fetchData();
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
          Join <span>{summaryInstalls} developers</span>
          <br /> using Radon IDE for faster,
          <br /> more efficient app development
        </h2>
        <div className={styles.buttonContainer}>
          <DownloadButtons trackFrom={trackFrom} />
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
