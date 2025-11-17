// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("./src/theme/CodeBlock/highlighting-light.js");
const darkCodeTheme = require("./src/theme/CodeBlock/highlighting-dark.js");
const autoNum = require("./src/remark/auto-num.js");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Radon – the Best IDE for React Native & Expo",
  favicon: "img/favicon.png",

  url: "https://ide.swmansion.com",

  baseUrl: "/",

  organizationName: "software-mansion",
  projectName: "radon-ide",

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
        googleTagManager: {
          containerId: "GTM-532228ST",
        },
      }),
    ],
  ],
  plugins: ["./src/plugins/changelog"],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/og-image.png",
      colorMode: {
        respectPrefersColorScheme: true,
        defaultMode: "dark",
      },
      navbar: {
        hideOnScroll: false,
        logo: {
          alt: "Radon logo",
          src: "img/logo.svg",
          srcDark: "img/logo-dark.svg",
          width: 116,
          height: 40,
        },
        items: [
          {
            to: "/pricing",
            activeBasePath: "pricing",
            label: "Pricing",
          },
          {
            to: "docs/category/getting-started",
            activeBasePath: "docs",
            label: "Docs",
          },
          {
            to: "/contact",
            activeBasePath: "contact",
            label: "Contact",
          },
          {
            "href": "https://github.com/software-mansion/radon-ide/",
            "position": "right",
            "className": "header-github",
            "aria-label": "GitHub repository",
          },
          {
            href: "https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide",
            position: "right",
            className: "header-download",
            html: "Download",
          },
        ],
      },
      footer: {
        style: "light",
        links: [
          { to: "/legal/privacy-policy", label: "Privacy" },
          { to: "/legal", label: "Legal" },
          { to: "https://portal.ide.swmansion.com/", label: "Customer Portal" },
          { to: "/docs/getting-started/changelog", label: "Changelog" },
          { to: "/contact", label: "Contact" },
        ],
        copyright: "All trademarks and copyrights belong to their respective owners.",
      },
      prism: {
        additionalLanguages: ["bash"],
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
      // announcementBar: {
      //   id: `product-hunt-launch-banner`,
      //   content: `🎉  Radon just launched on Product Hunt! <a href="https://www.producthunt.com/posts/radon-ide" target="_blank">Upvote!</a>`,
      // },
      metadata: [
        {
          name: "google-site-verification",
          content: "U0xic78Z5DjD9r0wrxOYQrLZPuSF_DZidnZeXPR4D0k",
        },
      ],
      algolia: {
        appId: "ZEU39T59G7",
        apiKey: "66a6ddfb41ef3a82ef2035614e307b1f",
        indexName: "ide-swmansion",
      },
    }),
};

module.exports = config;
