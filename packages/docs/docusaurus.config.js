// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

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
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
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
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
