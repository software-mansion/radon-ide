// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("./src/theme/CodeBlock/highlighting-light.js");
const darkCodeTheme = require("./src/theme/CodeBlock/highlighting-dark.js");
const autoNum = require("./src/remark/auto-num.js");

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
          beforeDefaultRemarkPlugins: [autoNum],
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
            to: "/pricing",
            activeBasePath: "pricing",
            label: "Pricing",
            position: "right",
          },
          {
            to: "docs/getting-started",
            activeBasePath: "docs",
            label: "Docs",
            position: "right",
          },
        ],
      },
      footer: {
        style: "light",
        links: [
          {
            to: "/privacy-policy",
            label: "Privacy Policy",
          },
          {
            to: "/terms-of-use",
            label: "Terms of Use",
          },
        ],
        copyright: "All trademarks and copyrights belong to their respective owners.",
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
      metadata: [
        {
          name: "google-site-verification",
          content: "U0xic78Z5DjD9r0wrxOYQrLZPuSF_DZidnZeXPR4D0k",
        },
      ],
    }),
};

module.exports = config;
