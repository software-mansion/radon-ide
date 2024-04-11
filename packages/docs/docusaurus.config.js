// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("./src/theme/CodeBlock/highlighting-light.js");
const darkCodeTheme = require("./src/theme/CodeBlock/highlighting-dark.js");

/** @type {import('@docusaurus/types').Config} */
const config = {
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
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          breadcrumbs: false,
          sidebarPath: require.resolve("./sidebars.js"),
          sidebarCollapsible: false,
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/og-image.png",
      navbar: {
        hideOnScroll: true,
        logo: {
          alt: "IDE logo",
          src: "img/logo.svg",
        },
        items: [
          {
            to: "docs/getting-started",
            activeBasePath: "docs",
            label: "Docs",
            position: "right",
          },
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
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
