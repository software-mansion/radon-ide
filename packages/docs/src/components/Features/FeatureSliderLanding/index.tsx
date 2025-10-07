import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";
import FeatureCardLanding, { ActiveItem } from "./FeatureCardLanding";
import { motion, AnimatePresence } from "motion/react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { useInView } from "react-intersection-observer";

export default function FeatureSliderLanding() {
  const [activeItem, setActiveItem] = useState<ActiveItem>({
    index: 0,
  });

  const cardRefs = useRef([]);

  const features = [
    {
      badge: "Built-In Previews",
      title: "Integrated Experience",
      content:
        "See the preview of your application right where you need it the most – close to your codebase. Radon IDE runs iOS Simulator and Android emulator directly in your Visual Studio Code and Cursor project.",
      imageSrc: useBaseUrl("/img/screenshot_hero.png"),
    },
    {
      badge: "Element Inspector",
      title: "Click to Inspect",
      content:
        "Jump directly from preview to a file where your React Native component is defined. It can't really get simpler than that.",
      imageSrc: useBaseUrl("/img/hero.webp"),
    },
    {
      badge: "Network Inspector",
      title: "Inspect Network Requests",
      content:
        "Use the built-in network panel to inspect your application network activity right in the editor.",
      imageSrc: useBaseUrl("/img/screenshot_hero.png"),
    },
    {
      badge: "React Scan Integration",
      title: "Outline Renders",
      content:
        "Radon IDE can highlight components that re-render too frequently. See for yourself what parts of your application need optimization.",
      imageSrc: useBaseUrl("/img/hero.webp"),
    },
  ];

  const { ref: inViewRef, inView } = useInView({ threshold: 0.2 });

  useEffect(() => {
    const node = cardRefs.current[activeItem.index];
    if (node) inViewRef(node);
  }, [activeItem.index, inViewRef]);

  const duration = 6000;

  useEffect(() => {
    if (!inView) return;

    const start = Date.now();

    const interval = setInterval(() => {
      const timeElapsed = Date.now() - start;

      if (timeElapsed >= duration) {
        clearInterval(interval);
        setActiveItem((prev) => ({
          index: (prev.index + 1) % features.length,
        }));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [inView, activeItem.index, features.length]);

  return (
    <div className={styles.container}>
      <div className={styles.sliderContainer}>
        {features.map((feature, index) => (
          <FeatureCardLanding
            key={index}
            ref={(el) => (cardRefs.current[index] = el)}
            index={index}
            badge={feature.badge}
            title={feature.title}
            content={feature.content}
            isExpanded={activeItem.index === index}
            inView={inView}
            setActiveItem={setActiveItem}
          />
        ))}
      </div>
      <div className={styles.imageBackground}>
        <div className={styles.imageContainer}>
          <AnimatePresence>
            <motion.img
              key={activeItem.index}
              src={features[activeItem.index].imageSrc}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            />
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
