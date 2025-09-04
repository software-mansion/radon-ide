import React from "react";
import FeaturesGridCard from "./FeaturesGridCard";
import styles from "./styles.module.css";
import useBaseUrl from "@docusaurus/useBaseUrl";

export default function FeaturesGrid() {
  const featuresList = [
    {
      label: "Debugger",
      title: "Use breakpoints right in VSCode",
      content:
        "Our VSCode extension integrates tightly with your deep-linked application, allowing you to effortlessly jump around the navigation structure. It supports both React Navigation and Expo Router projects.",
      imageSrc: useBaseUrl("/img/features/feature_debugger_dark.svg"),
    },
    {
      label: "Router Integration",
      title: "Navigation made easier",
      content:
        "Our VSCode extension integrates tightly with your deep-linked application, allowing you to effortlessly jump around the navigation structure. It supports both React Navigation and Expo Router projects.",
      imageSrc: useBaseUrl("/img/features/feature_router_dark.svg"),
    },
    {
      label: "Logs",
      title: "Search through the logs easily",
      content:
        "Radon IDE uses the built-in VSCode console allowing you to filter through the logs. The links displayed in the console automatically link back to your source code.",
      imageSrc: useBaseUrl("/img/features/feature_logs_dark.svg"),
    },
    {
      label: "Previews",
      title: "Develop components in isolation",
      content:
        "Radon IDE comes with a package allowing to preview components in full isolation. Develop your components individually without distractions.",
      imageSrc: useBaseUrl("./img/features/feature_previews_dark.svg"),
    },
    {
      label: "Device Settings",
      title: "Adjust device settings on the fly",
      content:
        "Adjust text size, light/dark mode and more with just a few clicks. With our IDE for React Native, you can focus fully on your app without switching between windows.",
      imageSrc: useBaseUrl("/img/features/feature_device_dark.svg"),
    },
    {
      label: "Screen Recording",
      title: "Instant Replays",
      content:
        "Missed a bug? You can rewatch what happened on the device anytime. No need to manually start the recording ever again.",
      imageSrc: useBaseUrl("/img/features/feature_recording_dark.svg"),
    },
  ];
  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {featuresList.map((feature, index) => (
          <FeaturesGridCard
            label={feature.label}
            title={feature.title}
            content={feature.content}
            imageSrc={feature.imageSrc}
          />
        ))}
      </div>
    </div>
  );
}
