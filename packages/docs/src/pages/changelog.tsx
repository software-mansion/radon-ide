import React from "react";
import Layout from "@theme/Layout";

import styles from "./changelog.module.css";
import ChangelogScreen, { ChangelogItem } from "../components/Changelog";
import LearnMoreFooter from "../components/LearnMore/LearnMoreFooter";

// content field supports markdown
const changelog: ChangelogItem[] = [
  {
    version: "1.5.x",
    date: "2025-04-11",
    title: "Radon AI",
    content: `
- Radon AI
- Improved EAS workflows
- Home / App Switch buttons support
- Improved error & exception handling with clickable links
- Support for React Native 0.79
`,
  },
  {
    version: "1.4.x",
    date: "2025-03-10",
    title: "Zero-config React Query devtools, Outline Renders",
    content: `
- No config React Query devtools
- Visualize renders with React Scan
- JavaScript sampling profiler
- Tons of stability improvements
    `,
  },
  {
    version: "1.3.x",
    date: "2025-02-11",
    title: "Network Inspector, Redux DevTools",
    content: `
- Network tools panel
- First-party Redux DevTools integration
- The panel now matches editor theme by default 
    `,
  },
  {
    version: "1.2.x",
    date: "2025-01-15",
    title: "Redux and React Query DevTools",
    content: `
- Redux and React Query tools 
- Local EAS builds support
- UI updates making more room for device
- More stability improvements and bug fixes
    `,
  },
  {
    version: "1.1.x",
    date: "2024-12-18",
    title: "PNPM monorepos, console upgrades, and more",
    content: `
- Experimental Linux support
- Support for PNPM monorepos
- Console upgrades: log grouping, object previews, long data handling
- Better log-to-source links
    `,
  },
  {
    version: "1.0.x",
    date: "2024-12-03",
    title: "Stable release",
    content: `
- Router integration
- Jump to code
- Built-in Debugger
- Preview components
- Adjust device settings
    `,
  },
];

export default function Changelog(): JSX.Element {
  return (
    <Layout description="A better developer experience for React Native developers.">
      <div className={styles.container}>
        <h1>Changelog</h1>
        <ChangelogScreen changelog={changelog} />
        <LearnMoreFooter />
      </div>
    </Layout>
  );
}
