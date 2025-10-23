import React, { useEffect, useRef, useState } from "react";
import FeaturesGridCard from "../FeaturesGridCard";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import usePageType from "@site/src/hooks/usePageType";
import ArrowRightSmallIcon from "../../ArrowRightSmallIcon";
import { motion } from "motion/react";
import { useColorMode } from "@docusaurus/theme-common";
import { getFeaturesList } from "./getFeaturesList";

export default function FeaturesGrid() {
  const { colorMode } = useColorMode();

  const [featuresList, setFeaturesList] = useState(() => getFeaturesList("dark"));
  const { isFeatures } = usePageType();

  const [firstLeftCardIdx, setFirstLeftCardIdx] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [cardPosition, setCardPosition] = useState(0);
  const [visibleCards, setVisibleCards] = useState(3);
  const [isDragging, setIsDragging] = useState(false);

  const windowRef = useRef(null);
  const containerRef = useRef(null);
  const cardRefs = useRef([]);

  const calculatedPosition = () => {
    if (!cardRefs.current[firstLeftCardIdx] || !windowRef.current || !cardRefs.current[0]) return 0;

    const cardLeft = cardRefs.current[firstLeftCardIdx].offsetLeft;
    const windowWidth = windowRef.current.offsetWidth;
    const containerWidth = containerRef.current.scrollWidth;

    let position = cardLeft;
    if (containerWidth - position <= windowWidth) {
      position = containerWidth - windowWidth;
    }

    return position;
  };

  const dragConstraints = () => {
    if (!containerRef.current || !windowRef.current) {
      return { left: 0, right: 0 };
    }

    const containerWidth = containerRef.current.scrollWidth;
    const windowWidth = windowRef.current.offsetWidth;

    return {
      left: -(containerWidth - windowWidth || 0),
      right: 0,
    };
  };

  useEffect(() => {
    setFeaturesList(getFeaturesList(colorMode));
  }, [colorMode]);

  useEffect(() => {
    if (!cardRefs.current[0]) return;
    const newCardWidth = cardRefs.current[0].offsetWidth;
    setCardWidth(newCardWidth);
    setCardPosition(calculatedPosition());
  }, [calculatedPosition]);

  useEffect(() => {
    if (isFeatures || !windowRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const windowWidth = entry.contentRect.width;
      const currentCardWidth = cardRefs.current[0]?.offsetWidth || 0;

      const newVisibleCards = Math.ceil(windowWidth / currentCardWidth);
      setVisibleCards(newVisibleCards);
    });

    observer.observe(windowRef.current);
    return () => observer.disconnect();
  }, [isFeatures]);

  const handleNextArrow = () => {
    setFirstLeftCardIdx((prev) => Math.min(prev + 1, featuresList.length - 1));
  };

  const handlePrevArrow = () => {
    setFirstLeftCardIdx((prev) => Math.max(prev - 1, 0));
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    const winRect = windowRef.current?.getBoundingClientRect();
    if (!winRect) return;

    const windowLeft = winRect.left;
    let centerIndex = 0;
    let minDistance = winRect.width;

    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cardCenter = rect.left;
      const distance = Math.abs(cardCenter - windowLeft);

      if (distance < minDistance) {
        minDistance = distance;
        centerIndex = i;
      }
    });
    setFirstLeftCardIdx(centerIndex);
    setIsDragging(false);
  };

  return (
    <div className={!isFeatures ? styles.wrapperLanding : styles.wrapper}>
      <div className={styles.overflow} ref={windowRef}>
        <motion.div
          ref={containerRef}
          animate={{ x: !isFeatures && !isDragging && -cardPosition }}
          transition={{ duration: 0.6, type: "linear" }}
          drag="x"
          dragConstraints={dragConstraints()}
          dragTransition={{ bounceStiffness: 200, bounceDamping: 20 }}
          dragElastic={0.2}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          whileDrag={{ cursor: "grabbing", userSelect: "none" }}
          className={!isFeatures ? styles.landingContainer : styles.container}>
          {featuresList.map((feature, index) => (
            <FeaturesGridCard
              key={index}
              label={feature.label}
              ref={(el) => (cardRefs.current[index] = el)}
              title={feature.title}
              content={feature.content}
              imageSrc={useBaseUrl(feature.imageSrc)}
            />
          ))}
        </motion.div>
      </div>
      {!isFeatures && (
        <div className={styles.navigationArrows}>
          <div className={styles.arrow}>
            <button
              className={styles.arrowLeft}
              disabled={firstLeftCardIdx === 0}
              onClick={handlePrevArrow}>
              <ArrowRightSmallIcon />
            </button>
          </div>
          <div className={styles.arrow}>
            <button
              className={styles.arrowRight}
              disabled={firstLeftCardIdx >= featuresList.length - visibleCards + 1}
              onClick={handleNextArrow}>
              <ArrowRightSmallIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
