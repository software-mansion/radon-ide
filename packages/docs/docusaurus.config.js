// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("./src/theme/CodeBlock/highlighting-light.js");
const darkCodeTheme = require("./src/theme/CodeBlock/highlighting-dark.js");
const autoNum = require("./src/remark/auto-num.js");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Radon IDE – An IDE for React Native",
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
            to: "docs/category/getting-started",
            activeBasePath: "docs",
            label: "Docs",
            position: "right",
          },
          {
            "href": "https://github.com/software-mansion/radon-ide/",
            "position": "right",
            "className": "header-github",
            "aria-label": "GitHub repository",
          },
        ],
      },
      footer: {
        style: "light",
        links: [
          { to: "/legal/privacy-policy", label: "Privacy" },
          { to: "/legal", label: "Legal" },
          { to: "https://portal.ide.swmansion.com/", label: "Customer Portal" },
          { to: "/changelog", label: "Changelog" },
        ],
        copyright: "All trademarks and copyrights belong to their respective owners.",
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
      // announcementBar: {
      //   id: `product-hunt-launch-banner`,
      //   content: `🎉  Radon IDE just launched on Product Hunt! <a href="https://www.producthunt.com/posts/radon-ide" target="_blank">Upvote!</a>`,
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
