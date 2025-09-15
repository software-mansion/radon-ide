import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import FeaturesGridCard from "../FeaturesGridCard";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";
import usePageType from "@site/src/hooks/usePageType";
import ArrowRightSmallIcon from "../../ArrowRightSmallIcon";
import { motion } from "motion/react";
import { useColorMode } from "@docusaurus/theme-common";

export default function FeaturesGrid() {
  const { colorMode } = useColorMode();

  const featuresList = [
    {
      label: "Debugger",
      title: "Use breakpoints right in VSCode",
      content:
        "Our VSCode extension integrates tightly with your deep-linked application, allowing you to effortlessly jump around the navigation structure. It supports both React Navigation and Expo Router projects.",
      imageSrc: useBaseUrl(`/img/features/feature_debugger_${colorMode}.svg`),
    },
    {
      label: "Router Integration",
      title: "Navigation made easier",
      content:
        "Our VSCode extension integrates tightly with your deep-linked application, allowing you to effortlessly jump around the navigation structure. It supports both React Navigation and Expo Router projects.",
      imageSrc: useBaseUrl(`/img/features/feature_router_${colorMode}.svg`),
    },
    {
      label: "Logs",
      title: "Search through the logs easily",
      content:
        "Radon IDE uses the built-in VSCode console allowing you to filter through the logs. The links displayed in the console automatically link back to your source code.",
      imageSrc: useBaseUrl(`/img/features/feature_logs_${colorMode}.svg`),
    },
    {
      label: "Previews",
      title: "Develop components in isolation",
      content:
        "Radon IDE comes with a package allowing to preview components in full isolation. Develop your components individually without distractions.",
      imageSrc: useBaseUrl(`/img/features/feature_previews_${colorMode}.svg`),
    },
    {
      label: "Device Settings",
      title: "Adjust device settings on the fly",
      content:
        "Adjust text size, light/dark mode and more with just a few clicks. With our IDE for React Native, you can focus fully on your app without switching between windows.",
      imageSrc: useBaseUrl(`/img/features/feature_device_${colorMode}.svg`),
    },
    {
      label: "Screen Recording",
      title: "Instant Replays",
      content:
        "Missed a bug? You can rewatch what happened on the device anytime. No need to manually start the recording ever again.",
      imageSrc: useBaseUrl(`/img/features/feature_recording_${colorMode}.svg`),
    },
  ];

  const { isFeatures } = usePageType();

  const [first, setFirst] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [cardPosition, setCardPosition] = useState(0);
  const [visibleCards, setVisibleCards] = useState(3);
  const [isDragging, setIsDragging] = useState(false);

  const windowRef = useRef(null);
  const containerRef = useRef(null);
  const cardRefs = useRef([]);

  const calculatedPosition = () => {
    if (!cardRefs.current[first] || !windowRef.current || !cardRefs.current[0]) return 0;

    const cardLeft = cardRefs.current[first].offsetLeft;
    const windowWidth = windowRef.current.offsetWidth;
    const cardWidth = cardRefs.current[0].offsetWidth;

    let position = cardLeft + cardWidth / 2 - windowWidth / 2;

    if (windowWidth > 400 && first === 0) {
      position = cardLeft;
    }

    if (windowWidth > 400 && first === featuresList.length - 1) {
      position = cardLeft + cardWidth - windowWidth;
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
    if (!cardRefs.current[0]) return;
    const newCardWidth = cardRefs.current[0].offsetWidth;
    setCardWidth(newCardWidth);
    setCardPosition(calculatedPosition);
  }, [calculatedPosition, cardWidth]);

  useEffect(() => {
    if (isFeatures || !windowRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const windowWidth = entry.contentRect.width;
      const currentCardWidth = cardRefs.current[0]?.offsetWidth || 0;

      if (!currentCardWidth) {
        setVisibleCards(2);
        return;
      }

      const newVisibleCards = Math.floor(windowWidth / currentCardWidth);
      setVisibleCards(newVisibleCards);
    });

    observer.observe(windowRef.current);
    return () => observer.disconnect();
  }, [isFeatures]);

  const handleNextArrow = () => {
    if (visibleCards > 2 && first === 0) {
      setFirst(2);
    } else {
      setFirst((prev) => Math.min(prev + 1, featuresList.length - 1));
    }
  };

  const handlePrevArrow = () => {
    setFirst((prev) => Math.max(prev - 1, 0));
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    const winRect = windowRef.current?.getBoundingClientRect();
    if (!winRect) return;

    const screenCenter = winRect.left + winRect.width / 2;
    let centerIndex = 0;
    let minDistance = winRect.width;

    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenter - screenCenter);

      if (distance < minDistance) {
        minDistance = distance;
        centerIndex = i;
      }
    });
    setFirst(centerIndex);
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
              imageSrc={feature.imageSrc}
            />
          ))}
        </motion.div>
      </div>
      {!isFeatures && (
        <div className={styles.navigationArrows}>
          <div className={styles.arrow}>
            <button
              className={styles.arrowLeft}
              disabled={first === 0 || (visibleCards === 3 && first === 1)}
              onClick={handlePrevArrow}>
              <ArrowRightSmallIcon />
            </button>
          </div>
          <div className={styles.arrow}>
            <button
              className={styles.arrowRight}
              disabled={first >= featuresList.length - Math.ceil(visibleCards / 2)}
              onClick={handleNextArrow}>
              <ArrowRightSmallIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
