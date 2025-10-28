import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";
import FeatureCardLanding, { ActiveItem } from "./FeatureCardLanding";
import { motion, AnimatePresence } from "motion/react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { useInView } from "react-intersection-observer";

const PROGRESS_BAR_DURATION = 6000;

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
      videoSrc: {
        light: useBaseUrl("/video/landing/integrated-experience-light.mp4"),
        dark: useBaseUrl("/video/landing/integrated-experience-dark.mp4"),
      },
    },
    {
      badge: "Element Inspector",
      title: "Click to Inspect",
      content:
        "Jump directly from preview to a file where your React Native component is defined. It can't really get simpler than that.",
      videoSrc: {
        light: useBaseUrl("/video/landing/element-inspector-light.mp4"),
        dark: useBaseUrl("/video/landing/element-inspector-dark.mp4"),
      },
    },
    {
      badge: "Network Inspector",
      title: "Inspect Network Requests",
      content:
        "Use the built-in network panel to inspect your application network activity right in the editor.",
      videoSrc: {
        light: useBaseUrl("/video/landing/network-inspector-light.mp4"),
        dark: useBaseUrl("/video/landing/network-inspector-dark.mp4"),
      },
    },
    {
      badge: "React Scan Integration",
      title: "Outline Renders",
      content:
        "Radon IDE can highlight components that re-render too frequently. See for yourself what parts of your application need optimization.",
      videoSrc: {
        light: useBaseUrl("/video/landing/outline-renders-light.mp4"),
        dark: useBaseUrl("/video/landing/outline-renders-dark.mp4"),
      },
    },
  ];

  const { ref: inViewRef, inView } = useInView({ threshold: 0.2 });

  useEffect(() => {
    const node = cardRefs.current[activeItem.index];
    if (node) inViewRef(node);
  }, [activeItem.index, inViewRef]);

  useEffect(() => {
    if (!inView) return;

    const timeout = setTimeout(() => {
      setActiveItem((prev) => ({
        index: (prev.index + 1) % features.length,
      }));
    }, PROGRESS_BAR_DURATION);

    return () => clearTimeout(timeout);
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
            <motion.video
              key={`${activeItem.index}-light`}
              autoPlay
              className={styles.videoLight}
              style={{ width: "100%" }}
              loop
              muted
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}>
              <source src={features[activeItem.index].videoSrc.light} type="video/mp4" />
            </motion.video>
            <motion.video
              key={`${activeItem.index}-dark`}
              autoPlay
              className={styles.videoDark}
              style={{ width: "100%" }}
              loop
              muted
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}>
              <source src={features[activeItem.index].videoSrc.dark} type="video/mp4" />
            </motion.video>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
