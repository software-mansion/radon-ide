import React, { useState } from "react";
import styles from "./styles.module.css";
import FeatureCardLanding, { ActiveItem } from "./FeatureCardLanding";

const features = [
  {
    badge: "Built-In Previews",
    title: "Integrated Experience",
    content:
      "See the preview of your application right where you need it the most – close to your codebase. Radon IDE runs iOS Simulator and Android emulator directly in your Visual Studio Code and Cursor project.",
  },
  {
    badge: "Element Inspector",
    title: "Click to Inspect",
    content:
      "Jump directly from preview to a file where your React Native component is defined. It can't really get simpler than that.",
  },
  {
    badge: "Network Inspector",
    title: "Inspect Network Requests",
    content:
      "Use the built-in network panel to inspect your application network activity right in the editor.",
  },
  {
    badge: "React Scan Integration",
    title: "Outline Renders",
    content:
      "Radon IDE can highlight components that re-render too frequently. See for yourself what parts of your application need optimization.",
  },
];

export default function FeatureScrollLanding() {
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([
    {
      index: null,
      height: 0,
    },
  ]);

  return (
    <div className={styles.container}>
      <div>
        {features.map((feature, index) => (
          <FeatureCardLanding
            key={index}
            index={index}
            badge={feature.badge}
            title={feature.title}
            content={feature.content}
            activeItems={activeItems}
            setActiveItems={setActiveItems}
          />
        ))}
      </div>
    </div>
  );
}
