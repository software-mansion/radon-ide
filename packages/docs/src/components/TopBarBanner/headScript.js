const { TOP_BAR_BANNER } = require("./config");
const FIRST_ZONE = TOP_BAR_BANNER.zones[0];

const MIN_VISIBLE_HEIGHT = 5;
const CACHE_PREFIX = "swm.topbarbanner.v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const VAR_HEIGHT_PREFIX = "--banner-height";
const VAR_BG_PREFIX = "--banner-bg";

/** @type {(zoneId: string, contentId: string) => string} */
const cacheKey = (zoneId, contentId) =>
  `${CACHE_PREFIX}.${zoneId}.${contentId}`;

/** @type {(zoneId: string, contentId: string) => { height: string; bg: string }} */
const varNames = (zoneId, contentId) => {
  const suffix = `${zoneId}-${contentId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  return {
    height: `${VAR_HEIGHT_PREFIX}-${suffix}`,
    bg: `${VAR_BG_PREFIX}-${suffix}`,
  };
};

/** Inline `<head>` script: reserves the cached banner size on `<html>` before
 * the body paints. Skips `hiddenPaths` (checked against `location.pathname`). */
const reservationScript = (zoneId, contentId, hiddenPaths) => {
  const vars = varNames(zoneId, contentId);
  return (
    `(function(){try{` +
    `var hp=${JSON.stringify(hiddenPaths ?? [])};var p=location.pathname;` +
    `if(hp.some(function(x){return p===x||p.indexOf(x+"/")===0}))return;` +
    `var k=${JSON.stringify(cacheKey(zoneId, contentId))};` +
    `var raw=localStorage.getItem(k);if(!raw)return;` +
    `var c=JSON.parse(raw);` +
    `if(!c||typeof c.height!=="number"||c.height<${MIN_VISIBLE_HEIGHT})return;` +
    `if(Date.now()-c.timestamp>=${CACHE_TTL_MS})return;` +
    `var r=document.documentElement;` +
    `r.style.setProperty(${JSON.stringify(vars.height)},c.height+"px");` +
    `if(typeof c.bgColor==="string")r.style.setProperty(${JSON.stringify(
      vars.bg
    )},c.bgColor);` +
    `}catch(e){}})();`
  );
};

module.exports = {
  MIN_VISIBLE_HEIGHT,
  cacheKey,
  varNames,
  topBarBannerHeadScript: reservationScript(
    FIRST_ZONE.zoneId,
    FIRST_ZONE.contentId,
    TOP_BAR_BANNER.hiddenPaths
  ),
};
