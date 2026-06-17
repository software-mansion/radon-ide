/** @type {import("./shared").BannerZone[]} */
const zones = [
  {
    zoneId: "radon-topbar-1",
    contentId: "ea15c4216158c4097b65fe6504a4b3b7",
    fallbackBgColor: "#248363",
  },
  {
    zoneId: "radon-topbar-2",
    contentId: "ea15c4216158c4097b65fe6504a4b3b7",
    fallbackBgColor: "#248363",
  },
  {
    zoneId: "radon-topbar-3",
    contentId: "ea15c4216158c4097b65fe6504a4b3b7",
    fallbackBgColor: "#248363",
  },
];

const TOP_BAR_BANNER = {
  rotateIntervalMs: 4000,
  hiddenPaths: ["/docs", "/contact"],
  zones,
};

module.exports = { TOP_BAR_BANNER };
