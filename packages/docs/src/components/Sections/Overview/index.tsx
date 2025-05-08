import React from "react";
import styles from "./styles.module.css";
import Elipse from "@site/src/components/Elipse";
import OverviewItem from "@site/src/components/Sections/Overview/OverviewItem";

const items = [
  {
    label: "An IDE",
    title: "Integrated experience",
    body: "See the preview of your application right where you need it the most – close to your codebase. \n\nRadon IDE runs IOS Simulator and Android emulator directly in your Visual Studio Code and Cursor project.",
    mediaSrc: "video/1_sztudio_integrated.mp4",
    placeholderSrc: "video/placeholders/1_sztudio_integrated_placeholder.webp",
  },
  {
    label: "Element Inspector",
    title: "Click to inspect",
    body: "Jump directly from preview to a file where your React Native component is defined. It can't really get simpler than that.",
    mediaSrc: "video/2_sztudio_inspect.mp4",
    placeholderSrc: "video/placeholders/2_sztudio_inspect_placeholder.webp",
  },
  {
    label: "Debugger",
    title: "Use breakpoints right in VSCode",
    body: "Add React Native breakpoints in Visual Studio Code to debug your React Native applications. No extra setup needed. It. Just. Works.\n\nWhat's more, Radon IDE automatically stops at runtime exceptions and shows you the exact line of code where they happened.",
    mediaSrc: "video/3_sztudio_debugger.mp4",
    placeholderSrc: "video/placeholders/3_sztudio_debugger_placeholder.webp",
  },
  {
    label: "Router integration",
    title: "Navigation made easier",
    body: "Our VSCode extension integrates tightly with your deep-linked application, allowing you to effortlessly jump around the navigation structure. It supports both React Navigation and Expo Router projects.",
    mediaSrc: "video/4_sztudio_url_bar.mp4",
    placeholderSrc: "video/placeholders/4_sztudio_url_bar_placeholder.webp",
  },
  {
    label: "Logs",
    title: "Search through the logs easily",
    body: "Radon IDE uses the built-in VSCode console allowing you to filter through the logs.\n\nThe links displayed in the console automatically link back to your source code.",
    mediaSrc: "video/5_sztudio_logs_panel.mp4",
    placeholderSrc: "video/placeholders/5_sztudio_logs_panel_placeholder.webp",
  },
  {
    label: "Previews",
    title: "Develop components in isolation",
    body: "Radon IDE comes with a package allowing to preview components in full isolation.\n\nDevelop your components individually without distractions.",
    mediaSrc: "video/6_sztudio_preview.mp4",
    placeholderSrc: "video/placeholders/6_sztudio_preview_placeholder.webp",
  },
  {
    label: "Device settings",
    title: "Adjust device settings on the fly",
    body: "Adjust text size, light/dark mode and more with just a few clicks.\n\nWith our IDE for React Native, you can focus fully on your app without switching between windows.",
    mediaSrc: "video/7_sztudio_device_settings.mp4",
    placeholderSrc: "video/placeholders/7_sztudio_device_settings_placeholder.webp",
  },
  {
    label: "Screen recording",
    title: "Instant replays",
    body: "Missed a bug? You can rewatch what happened on the device anytime.\n\nNo need to manually start the recording ever again.",
    mediaSrc: "video/ide_screen_recording.mp4",
    placeholderSrc: "video/placeholders/ide_screen_recording_placeholder.webp",
  },
  {
    label: "React Scan integration",
    title: "Outline renders",
    body: "Radon IDE can highlight components that re-render too frequently.\n\nSee for yourself what parts of your application need optimization.",
    mediaSrc: "video/8_sztudio_outline_renders.mp4",
    placeholderSrc: "video/placeholders/8_sztudio_outline_renders_placeholder.webp",
  },
  {
    label: "Network Inspector",
    title: "Inspect network requests",
    body: "Use the built-in network panel to inspect your application network activity right in the editor.",
    mediaSrc: "video/9_sztudio_network_inspector.mp4",
    placeholderSrc: "video/placeholders/9_sztudio_network_inspector_placeholder.webp",
  },
];

const Overview = () => {
  return (
    <section>
      <div className={styles.elipseContainer}>
        <Elipse className={styles.elipse} size={235} />
        <Elipse isSmall className={styles.elipse} />
      </div>
      <div className={styles.overview}>
        <h2 className={styles.overviewHeading}>How it works?</h2>
        <div className={styles.overviewItemsContainer}>
          {items.map((item, idx) => (
            <div key={idx} className={styles.item}>
              <OverviewItem
                label={item.label}
                title={item.title}
                body={item.body}
                mediaSrc={item.mediaSrc}
                placeholderSrc={item.placeholderSrc}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Overview;
