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
  activeItems: ActiveItem[];
  setActiveItems: (items: ActiveItem[]) => void;
}

export default function FeatureCardLanding({
  index,
  badge,
  title,
  content,
  activeItems,
  setActiveItems,
}: FeatureCardLandingProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  const isExpanded = activeItems.some((item) => item.index === index);

  const toggleAnswer = () => {
    if (isExpanded) {
      setActiveItems(activeItems.filter((item) => item.index !== index));
    } else {
      const height = contentRef.current?.clientHeight;
      setActiveItems([...activeItems, { index, height }]);
    }
  };

  function contentShow() {
    return { __html: content };
  }
  function badgeShow() {
    return { __html: badge };
  }
  return (
    <div className={styles.cardContainer}>
      <div role="region" aria-labelledby={`feature-${index}`}>
        <div
          className={styles.hideContainer}
          style={{
            maxHeight:
              isExpanded && contentRef.current?.clientHeight
                ? `calc(${contentRef.current?.clientHeight}px + 0.5rem)`
                : 0,
          }}>
          <div
            className={styles.cardBadge}
            ref={contentRef}
            dangerouslySetInnerHTML={badgeShow()}
          />
        </div>
      </div>
      <button id={`feature-${index}`} aria-expanded={isExpanded} onClick={() => toggleAnswer()}>
        <div className={styles.cardTitle}>{title}</div>
      </button>
      <div role="region" aria-labelledby={`feature-${index}`}>
        <div
          className={styles.hideContainer}
          style={{
            maxHeight:
              isExpanded && contentRef.current?.clientHeight
                ? `calc(${contentRef.current?.clientHeight}px + 0.5rem)`
                : 0,
          }}>
          <div
            className={styles.cardContent}
            ref={contentRef}
            dangerouslySetInnerHTML={contentShow()}
          />
        </div>
      </div>
    </div>
  );
}
