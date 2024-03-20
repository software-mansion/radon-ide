import styles from "./styles.module.css";
import Elipse from "@site/src/components/Elipse";
import OverviewItem from "@site/src/components/Sections/Overview/OverviewItem";

const items = [
  {
    title: "Integrated experience",
    body: "See the preview of your application right where you need it the most – close to your codebase. \nReact Native IDE runs IOS Simulator and Android emulator directly in your Visual Studio Code project.",
    mediaSrc: "video/1_sztudio_integrated.mp4",
  },
  {
    title: "Click to inspect",
    body: "Using the built-in inspector you can jump directly from preview to a file where your component is defined. It can't really get simpler than that.",
    mediaSrc: "video/2_sztudio_inspect.mp4",
  },
  {
    title: "Use breakpoints right in VSCode",
    body: "Without any additional setup the extension allows to add a breakpoints in Visual Studio Code to debug your React Native application. It. Just. Works.\nIDE also automatically stops at runtime exceptions showing you the exact line of code where they happened",
    mediaSrc: "video/3_sztudio_debugger.mp4",
  },
  {
    title: "Navigation made easier",
    body: "The React Native IDE integrates tightly with your deep-linked application allowing you to jump around the navigation structure. Supports both Expo Router and React Navigation projects.",
    mediaSrc: "video/4_sztudio_url_bar.mp4",
  },
  {
    title: "Search through the logs easily",
    body: "React Native IDE uses the built-in VSCode console allowing you to filter through the logs.\nThe links displayed in the console are automatically linking back to your source code.",
    mediaSrc: "video/5_sztudio_logs_panel.mp4",
  },
  {
    title: "Develop components in isolation",
    body: "React Native IDE comes with a package allowing to preview components in full isolation.\nDevelop your components individually without distractions.",
    mediaSrc: "video/6_sztudio_preview.mp4",
  },
  {
    title: "Adjust device settings on the fly",
    body: "You can adjust text size and light/dark mode right from the React Native IDE.\nFocus just on your app without switching between windows.",
    mediaSrc: "video/7_sztudio_device_settings.mp4",
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
            <div className={styles.item}>
              <OverviewItem
                key={idx}
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
