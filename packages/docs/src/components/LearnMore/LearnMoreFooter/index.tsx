import React from "react";
import styles from "./styles.module.css";
import DownloadButtons from "../../DownloadButtons";
import RadonIconGreen from "../../RadonIconGreen";
import usePageType from "@site/src/hooks/usePageType";
import clsx from "clsx";
import useInstallCount from "@site/src/hooks/useInstallCount";

const LearnMoreFooter = () => {
  const { data: summaryInstalls, isLoading } = useInstallCount({ defaultValue: "45,000+" });
  const { isLanding } = usePageType();
  const trackFrom = isLanding ? "Landing bottom" : "Features bottom";

  return (
    <div
      className={clsx(
        styles.learnMoreSectionFooter,
        !isLoading && styles.show,
        isLanding ? styles.sectionLanding : styles.sectionFeature
      )}>
      <div
        className={clsx(
          styles.contentContainer,
          isLanding ? styles.containerLanding : styles.containerFeature
        )}>
        <h2>
          Join <span>{summaryInstalls} developers</span>
          <br /> using Radon for faster,
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
