import React, { useRef } from "react";
import styles from "./styles.module.css";

export interface ActiveItem {
  index: number;
  height: number;
}

interface FeatureCardLandingProps {
  index: number;
  badge: string;
  title: string;
  content: string;
  isExpanded: boolean;
  setActiveItem: (value: ActiveItem | null) => void;
}

export default function FeatureCardLanding({
  index,
  badge,
  title,
  content,
  isExpanded,
  setActiveItem,
}: FeatureCardLandingProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  const toggleAnswer = () => {
    if (!isExpanded) {
      setActiveItem({ index: index, height: contentRef.current?.clientHeight });
    }
  };

  return (
    <div className={styles.cardContainer}>
      <div role="region" aria-labelledby={`feature-${index}`}>
        <div
          className={`${styles.hiddenBadge} ${isExpanded ? styles.slide : ""}`}
          style={{
            maxHeight: isExpanded ? badgeRef.current?.clientHeight ?? 0 : 0,
          }}>
          <div className={styles.cardBadge} ref={badgeRef}>
            {badge}
          </div>
        </div>
      </div>
      <button id={`feature-${index}`} aria-expanded={isExpanded} onClick={() => toggleAnswer()}>
        <div className={`${styles.cardTitle} ${isExpanded ? styles.activeTitle : null}`}>
          {title}
        </div>
      </button>
      <div role="region" aria-labelledby={`feature-${index}`}>
        <div
          className={styles.hideContainer}
          style={{
            maxHeight: isExpanded ? contentRef.current?.clientHeight ?? 0 : 0,
          }}>
          <div className={styles.cardContent} ref={contentRef}>
            {content}
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className={styles.progressContainer}>
          <div className={`${styles.progress} ${styles.progressMoved}`}>
            <div className={styles.progressBar}></div>
          </div>
        </div>
      )}
    </div>
  );
}
