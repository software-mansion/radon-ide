import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";
import clsx from "clsx";

export interface ActiveItem {
  index: number;
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

  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    if (isExpanded) {
      setProgressKey((prev) => prev + 1);
    }
  }, [isExpanded]);

  const toggleAnswer = () => {
    if (!isExpanded) {
      setActiveItem({ index: index });
    }
  };

  return (
    <div className={clsx(styles.cardContainer, isExpanded && styles.space)}>
      <div className={clsx(styles.cardInfo, !isExpanded && styles.smallGap)}>
        <div role="region" aria-labelledby={`feature-${index}`}>
          <div
            className={clsx(styles.hiddenBadge, isExpanded && styles.slide)}
            style={{
              maxHeight: isExpanded ? badgeRef.current?.clientHeight ?? 0 : 0,
            }}>
            <div className={styles.cardBadge} ref={badgeRef}>
              {badge}
            </div>
          </div>
        </div>
        <button id={`feature-${index}`} aria-expanded={isExpanded} onClick={() => toggleAnswer()}>
          <div className={clsx(styles.cardTitle, isExpanded && styles.activeTitle)}>{title}</div>
        </button>
        <div role="region" aria-labelledby={`feature-${index}`}>
          <div
            className={styles.hiddenContainer}
            style={{
              maxHeight: isExpanded ? contentRef.current?.clientHeight ?? 0 : 0,
            }}>
            <div ref={contentRef}>
              <div className={styles.cardContent}>{content}</div>
              <div className={styles.progressContainer}>
                <div key={progressKey} className={clsx(styles.progress, styles.progressMoved)}>
                  <div className={styles.progressBar}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
