import React from "react";
import Layout from "@theme/Layout";

import styles from "./changelog.module.css";
import ChangelogScreen, { ChangelogItem } from "../components/Changelog";
import LearnMoreFooter from "../components/LearnMore/LearnMoreFooter";
import HomepageButton from "../components/HomepageButton";
import LinkButton from "../components/LinkButton";

// content field supports markdown
const changelog: ChangelogItem[] = [
  {
    version: "1.5.x",
    date: "2025-04-11",
    title: "Radon AI",
    content: `
- [**Radon AI Chat**](/docs/features/radon-ai): a GitHub Copilot Chat participant enhanced with up-to-date information about the React Native ecosystem. At the heart of it is our extensive React Native knowledge database, which is queried before answering your question.

<video autoPlay loop width="700" controls className="shadow-image changelog-item">
  <source src="/video/ide_chat.mp4" type="video/mp4"/>
</video>


- **Improved EAS workflows**: Radon IDE will now display clearer build error messages and only download compatible builds from EAS by default.

- **Home / App Switch buttons support**: Added options in the device settings menu that can trigger Home and AppSwitch button presses on the active device.

- Improved bundle error & exception handling, including a stack trace with links to source files

- Support for React Native 0.79
`,
    JSX: (
      <LinkButton
        title="See v1.5.0 release notes on GitHub"
        href="https://github.com/software-mansion/radon-ide/releases/tag/v1.5.0"
      />
    ),
  },
  {
    version: "1.4.x",
    date: "2025-03-10",
    title: "Zero-config React Query devtools, Outline Renders",
    content: `
- [**Outline Renders**](/docs/features/dev-tools#outline-renders-react-scan): a [react-scan](https://react-scan.com/) feature that helps you visualize React renders happening within the app.

<video autoPlay loop width="700" controls className="shadow-image changelog-item">
  <source src="/video/8_sztudio_outline_renders.mp4" type="video/mp4"/>
</video>


- [**No setup React Query devtools**](/docs/features/dev-tools#react-query): React Query devtools now doesn't require any additional configuration. If your app uses React Query you can investigate queries, modify data from the store, etc,

<video autoPlay loop width="700" controls className="shadow-image changelog-item">
  <source src="/video/ide_react_query.mp4" type="video/mp4"/>
</video>

- [**JavaScript sampling profiler**](/docs/features/dev-tools#cpu-profiling-javascript): Radon IDE integrates with the hermes sampling CPU profiler. Once you save the profiling file, the IDE will automatically open the saved profile and use the built-in Profile Visualizer plugin to display a profile.

<video autoPlay loop width="700" controls className="shadow-image changelog-item">
  <source src="/video/ide_js_sampling.mp4" type="video/mp4"/>
</video>

- Tons of stability improvements
    `,
    JSX: (
      <LinkButton
        title="See v1.4.0 release notes on GitHub"
        href="https://github.com/software-mansion/radon-ide/releases/tag/v1.4.0"
      />
    ),
  },
  {
    version: "1.3.x",
    date: "2025-02-11",
    title: "Network Inspector, Redux DevTools",
    content: `
- [**Built-in Network Inspector**](/docs/features/dev-tools#network-inspector): Network panel captures and lists all requests triggered by the JavaScript code (with HXR / fetch or wrappers like Axios/Apollo etc). Images or websocket connections aren't currently supported and won't show up.

<video autoPlay loop width="700" controls className="shadow-image changelog-item">
  <source src="/video/ide_network_inspector.mp4" type="video/mp4"/>
</video>

- [**First-party Redux DevTools integration**](/docs/features/dev-tools#redux): If your app uses Redux, the IDE will automatically detect that, and Redux plugin will be listed in the Dev Tools menu where you can enable it. Once enabled you will be able to use the official Redux UI from within your editor panel.

- The panel now matches editor theme by default

- Support for React Native 0.78
    `,
    JSX: (
      <LinkButton
        title="See v1.3.0 release notes on GitHub"
        href="https://github.com/software-mansion/radon-ide/releases/tag/v1.3.0"
      />
    ),
  },
  {
    version: "1.2.x",
    date: "2025-01-15",
    title: "Redux and React Query DevTools",
    content: `
- [**Redux and React Query tools**](/docs/features/dev-tools#redux-via-expo-devtools-plugin): An experimental support for launching Dev Tools as separate panels withing VSCode or Cursor via [Expo Devtools Plugins](https://docs.expo.dev/debugging/devtools-plugins/). When the IDE detects that a certain tool is available and configured properly, it will be listed in the tools menu where you can turn it on and off. Follow the setup instructions from [React Query Expo Devtool Plugin](https://docs.expo.dev/debugging/devtools-plugins/#react-query) and [Redux Devtool Plugin](https://docs.expo.dev/debugging/devtools-plugins/#redux) guides.

<img width="700" src="/img/docs/ide_devtools_expo_redux.png" className="shadow-image changelog-item" />

- [**Support for eas build --local**](/docs/guides/configuration#custom-build-settings): Radon IDE can now build your apps using [EAS Build with --local flag](https://docs.expo.dev/build-reference/local-builds/). This can be configured using the \`customBuild\` in \`launch.json\` file. 

- Support for React Native 0.77

- UI updates making more room for device

- More stability improvements and bug fixes
    `,
    JSX: (
      <LinkButton
        title="See v1.2.0 release notes on GitHub"
        href="https://github.com/software-mansion/radon-ide/releases/tag/v1.2.0"
      />
    ),
  },
  {
    version: "1.1.x",
    date: "2024-12-18",
    title: "PNPM monorepos, console upgrades, and more",
    content: `
- **Console upgrades**: log grouping, object previews, long data handling

- Experimental Linux support

- Support for PNPM monorepos

- Better log-to-source links
    `,
    JSX: (
      <LinkButton
        title="See v1.1.0 release notes on GitHub"
        href="https://github.com/software-mansion/radon-ide/releases/tag/v1.1.0"
      />
    ),
  },
  {
    version: "1.0.x",
    date: "2024-12-03",
    title: "Radon IDE 1.0 is live! 🎉 ",
    content: `
- [**Element inspector**](/docs/features/element-inspector): lets you quickly jump from the device preview to the exact line of code where given component is defined.

- [**Debugging and logging**](/docs/features/debugging-and-logging): Breakpoints work in VSCode without any additional setup for React Native and Expo projects. The links displayed in the console are automatically linking back to your source code.

- [**Router integration**](/docs/features/router-integration): Jump around the navigation structure supporting both Expo Router and React Navigation projects.

- [**Previews**](/docs/features/previews): Develop components in isolation.

- [**Storybook integration**](/docs/features/storybook-integration): The IDE automatically detects Storybook stories and provides a quick access to run them in the device preview.

- [**Device settings**](/docs/features/device-settings): Adjust various device settings right from VSCode.


- [**Instant replays**](/docs/features/screen-recording): Rewinds the last 5, 10, 30 seconds of what was happening on the device.

- **And many more...**

    `,
    JSX: (
      <HomepageButton
        target="_blank"
        href="https://youtu.be/07Un9EfE8D4?si=I3ZvMDLPaBzwHi3s"
        title="Watch the Radon IDE 1.0 announcement video"
      />
    ),
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
