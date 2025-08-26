import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";
import FeatureCardLanding, { ActiveItem } from "./FeatureCardLanding";
import { motion, AnimatePresence } from "motion/react";

const features = [
  {
    badge: "Built-In Previews",
    title: "Integrated Experience",
    content:
      "See the preview of your application right where you need it the most – close to your codebase. Radon IDE runs iOS Simulator and Android emulator directly in your Visual Studio Code and Cursor project.",
    imageSrc: "../img/screenshot_hero.png",
  },
  {
    badge: "Element Inspector",
    title: "Click to Inspect",
    content:
      "Jump directly from preview to a file where your React Native component is defined. It can't really get simpler than that.",
    imageSrc: "../img/hero.webp",
  },
  {
    badge: "Network Inspector",
    title: "Inspect Network Requests",
    content:
      "Use the built-in network panel to inspect your application network activity right in the editor.",
    imageSrc: "../img/screenshot_hero.png",
  },
  {
    badge: "React Scan Integration",
    title: "Outline Renders",
    content:
      "Radon IDE can highlight components that re-render too frequently. See for yourself what parts of your application need optimization.",
    imageSrc: "../img/hero.webp",
  },
];

export default function FeatureSliderLanding() {
  const [activeItem, setActiveItem] = useState<ActiveItem>({
    index: 0,
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setActiveItem((prev) => {
        const nextIndex = (prev.index + 1) % features.length;
        return { index: nextIndex };
      });
    }, 6000);

    return () => clearTimeout(timeout);
  }, [activeItem]);

  return (
    <div className={styles.container}>
      <div className={styles.sliderContainer}>
        {features.map((feature, index) => (
          <FeatureCardLanding
            key={index}
            index={index}
            badge={feature.badge}
            title={feature.title}
            content={feature.content}
            isExpanded={activeItem.index === index}
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
