export { MIN_VISIBLE_HEIGHT, cacheKey, varNames } from "./headScript";

export interface BannerZone {
  zoneId: string;
  contentId: string;
  fallbackBgColor?: string;
}

export const isBannerHidden = (pathname: string, hiddenPaths?: string[]) =>
  !!hiddenPaths?.some((p) => pathname === p || pathname.startsWith(`${p}/`));
