import React, { forwardRef } from "react";
import styles from "./styles.module.css";
import usePageType from "@site/src/hooks/usePageType";
import ThemedImage from "@theme/ThemedImage";
import clsx from "clsx";

interface FeatureGridCardProps {
  label: string;
  title: string;
  content: string;
  sources: {
    light: string;
    dark: string;
  };
}

const FeaturesGridCard = forwardRef<HTMLDivElement, FeatureGridCardProps>(
  ({ label, title, content, sources }, ref) => {
    const { isFeatures } = usePageType();

    return (
      <div ref={ref} className={!isFeatures ? styles.reverseContainer : styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <p className={!isFeatures ? styles.labelLanding : styles.label}>{label}</p>
            <p className={!isFeatures ? styles.titleLanding : styles.title}> {title}</p>
          </div>
          {isFeatures && <p className={styles.textContent}>{content}</p>}
        </div>
        <ThemedImage
          sources={sources}
          className={clsx(styles.gridSvg, isFeatures && styles.widthSvg)}
          alt={title}
        />
      </div>
    );
  }
);

export default FeaturesGridCard;
