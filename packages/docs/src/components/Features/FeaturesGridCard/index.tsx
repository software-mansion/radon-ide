import React, { forwardRef, useEffect, useState } from "react";
import styles from "./styles.module.css";
import usePageType from "@site/src/hooks/usePageType";
import clsx from "clsx";

interface FeatureGridCardProps {
  label: string;
  title: string;
  content: string;
  imageSrc: string;
}

const FeaturesGridCard = forwardRef<HTMLDivElement, FeatureGridCardProps>(
  ({ label, title, content, imageSrc }, ref) => {
    const { isFeatures } = usePageType();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return (
      <div ref={ref} className={!isFeatures ? styles.reverseContainer : styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <p className={!isFeatures ? styles.labelLanding : styles.label}>{label}</p>
            <p className={!isFeatures ? styles.titleLanding : styles.title}> {title}</p>
          </div>
          {isFeatures && <p className={styles.textContent}>{content}</p>}
        </div>
        <img className={clsx(styles.gridSvg, isFeatures && styles.widthSvg)} src={imageSrc}></img>
      </div>
    );
  }
);

export default FeaturesGridCard;
