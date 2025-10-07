import React, { useRef } from "react";
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
  progress: number;
  setActiveItem: (value: ActiveItem | null) => void;
}

const FeatureCardLanding = React.forwardRef<HTMLDivElement, FeatureCardLandingProps>(
  ({ index, badge, title, content, isExpanded, progress, setActiveItem }, ref) => {
    const contentRef = useRef<HTMLDivElement | null>(null);

    const toggleAnswer = () => {
      if (!isExpanded) {
        setActiveItem({ index: index });
      }
    };

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
                      className={styles.progressBar}
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ ease: "linear", duration: 0.05 }}
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
