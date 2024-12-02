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
  },
  {
    label: "Element Inspector",
    title: "Click to inspect",
    body: "Using the built-in inspector you can jump directly from preview to a file where your component is defined. It can't really get simpler than that.",
    mediaSrc: "video/2_sztudio_inspect.mp4",
  },
  {
    label: "Debugger",
    title: "Use breakpoints right in VSCode",
    body: "Without any additional setup the extension allows to add a breakpoints in Visual Studio Code to debug your React Native application. It. Just. Works.\n\nIDE also automatically stops at runtime exceptions showing you the exact line of code where they happened.",
    mediaSrc: "video/3_sztudio_debugger.mp4",
  },
  {
    label: "Router integration",
    title: "Navigation made easier",
    body: "The Radon IDE integrates tightly with your deep-linked application allowing you to jump around the navigation structure (supports both React Navigation and Expo Router projects).",
    mediaSrc: "video/4_sztudio_url_bar.mp4",
  },
  {
    label: "Logs",
    title: "Search through the logs easily",
    body: "Radon IDE uses the built-in VSCode console allowing you to filter through the logs.\n\nThe links displayed in the console are automatically linking back to your source code.",
    mediaSrc: "video/5_sztudio_logs_panel.mp4",
  },
  {
    label: "Previews",
    title: "Develop components in isolation",
    body: "Radon IDE comes with a package allowing to preview components in full isolation.\n\nDevelop your components individually without distractions.",
    mediaSrc: "video/6_sztudio_preview.mp4",
  },
  {
    label: "Device settings",
    title: "Adjust device settings on the fly",
    body: "You can adjust text size and light/dark mode right from the Radon IDE.\n\nFocus just on your app without switching between windows.",
    mediaSrc: "video/7_sztudio_device_settings.mp4",
  },
  {
    label: "Screen recording",
    title: "Instant replays",
    body: "Missed a bug? At any time you can re-watch what just happened on the device.\n\nNo need to manually start the recording ever again.",
    mediaSrc: "video/ide_screen_recording.mp4",
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
        <h1 className={styles.overviewHeading}>How it works?</h1>
        <div className={styles.overviewItemsContainer}>
          {items.map((item, idx) => (
            <div key={idx} className={styles.item}>
              <OverviewItem
                label={item.label}
                title={item.title}
                body={item.body}
                mediaSrc={item.mediaSrc}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Overview;
