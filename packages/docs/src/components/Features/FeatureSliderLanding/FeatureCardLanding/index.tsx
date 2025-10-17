import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";
import clsx from "clsx";
import { motion, LayoutGroup } from "motion/react";

export interface ActiveItem {
  index: number;
}

interface FeatureCardLandingProps {
  index: number;
  badge: string;
  title: string;
  content: string;
  isExpanded: boolean;
  inView: boolean;
  setActiveItem: (value: ActiveItem | null) => void;
}

const FeatureCardLanding = React.forwardRef<HTMLDivElement, FeatureCardLandingProps>(
  ({ index, badge, title, content, isExpanded, inView, setActiveItem }, ref) => {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [progressKey, setProgressKey] = useState(0);

    const toggleAnswer = () => {
      if (!isExpanded) {
        setActiveItem({ index: index });
      }
    };

    useEffect(() => {
      if (isExpanded || inView) {
        setProgressKey((prev) => prev + 1);
      }
    }, [isExpanded, inView]);

    return (
      <div
        className={clsx(styles.cardContainer, isExpanded && index !== 0 && styles.active)}
        ref={ref}>
        <LayoutGroup>
          <motion.div
            key={index}
            role="region"
            aria-labelledby={`feature-${index}`}
            className={clsx(styles.cardInfo, isExpanded && styles.active)}>
            <motion.div
              className={clsx(styles.hiddenBadge, isExpanded && styles.slide)}
              style={{
                height: isExpanded ? 36 : 0,
              }}>
              <div className={styles.cardBadge}>{badge}</div>
            </motion.div>
            <motion.button
              layout
              id={`feature-${index}`}
              aria-expanded={isExpanded}
              onClick={() => toggleAnswer()}>
              <div className={clsx(styles.cardTitle, isExpanded && styles.activeTitle)}>
                {title}
              </div>
            </motion.button>
            <motion.div
              id={`content-${index}`}
              className={clsx(styles.hiddenContainer, isExpanded && styles.slide)}
              style={{
                height: isExpanded ? undefined : 0,
              }}>
              <div ref={contentRef}>
                <div className={styles.cardContent}>{content}</div>
                <div className={styles.progressContainer}>
                  <div className={styles.progressBg}>
                    <motion.div
                      key={progressKey}
                      className={styles.progressBar}
                      initial={{ width: 0 }}
                      animate={{ width: `auto` }}
                      exit={{ width: "100%" }}
                      transition={{ ease: "linear", duration: 6 }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </LayoutGroup>
      </div>
    );
  }
);
export default FeatureCardLanding;
