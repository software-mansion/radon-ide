import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "React Native IDE",
  favicon: "img/favicon.png",

  url: "https://ide.swmansion.com",

  baseUrl: "/",

  organizationName: "software-mansion-labs",
  projectName: "react-native-ide",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/og-image.png",
    navbar: {
      logo: {
        alt: "IDE logo",
        src: "img/logo.svg",
      },
      items: [
        {
          href: "https://swmansion.com",
          className: "header-swm",
          position: "right",
        },
      ],
    },
    footer: {
      style: "light",
      links: [],
      copyright: "All trademarks and copyrights belong to their respective owners.",
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
