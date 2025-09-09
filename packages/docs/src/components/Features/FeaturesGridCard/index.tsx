import React, { forwardRef } from "react";
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
    const { isLanding } = usePageType();

    return (
      <div ref={ref} className={isLanding ? styles.reverseContainer : styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <p className={styles.label}>{label}</p>
            <p className={styles.title}> {title}</p>
          </div>
          {!isLanding && <p className={styles.textContent}>{content}</p>}
        </div>
        <img className={clsx(styles.gridSvg, !isLanding && styles.widthSvg)} src={imageSrc}></img>
      </div>
    );
  }
);

export default FeaturesGridCard;
