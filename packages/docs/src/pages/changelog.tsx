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
- [**Radon AI Chat**](/docs/features/radon-ai): a GitHub Copilot Chat participant enhanced with up-to-date information about the React Native ecosystem. At the heart of it is our extensive React Native knowledge database, which is queried before answering your question.

<video autoPlay loop width="700" controls className="shadow-image changelog-video">
  <source src="/video/ide_chat.mp4" type="video/mp4"/>
</video>


- **Improved EAS workflows**: You'll now see clearer build error messages directly, and all your EAS settings in launch configs are consistently recognized. Plus, automatic build fetching will show you only relevant builds.

- **Home / App Switch buttons support**: Added options in the device settings menu that can trigger Home and AppSwitch button presses on active device.

- **Improved error & exception handling with clickable links**,

- **Support for React Native 0.79**.
`,
  },
  {
    version: "1.4.x",
    date: "2025-03-10",
    title: "Zero-config React Query devtools, Outline Renders",
    content: `
- [**Outline Renders**](/docs/features/dev-tools#outline-renders-react-scan): [react-scan](https://react-scan.com/) integration that help you visualize React renders happening within the app.

<video autoPlay loop width="700" controls className="shadow-image changelog-video">
  <source src="/video/8_sztudio_outline_renders.mp4" type="video/mp4"/>
</video>


- [**No setup React Query devtools**](/docs/features/dev-tools#react-query): React Query devtools now doesn't require any additional configuration. If your app uses React Query you can investigate queries, modify data from the store, etc,

<video autoPlay loop width="700" controls className="shadow-image changelog-video">
  <source src="/video/ide_react_query.mp4" type="video/mp4"/>
</video>

- [**JavaScript sampling profiler**](/docs/features/dev-tools#cpu-profiling-javascript): Radon IDE integrates with the hermes sampling CPU profiler. Once you save the profiling file, the IDE will automatically open the saved profile and use the built-in Profile Visualizer plugin to display a profile.

<video autoPlay loop width="700" controls className="shadow-image changelog-video">
  <source src="/video/ide_js_sampling.mp4" type="video/mp4"/>
</video>

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
    title: "Stable release 🎉",
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
