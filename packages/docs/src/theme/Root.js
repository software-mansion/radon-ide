import React from "react";
import { useLocation } from "@docusaurus/router";
import { getInitColorSchemeScript } from "@mui/material/styles";
import { Experimental_CssVarsProvider as CssVarsProvider } from "@mui/material/styles";
import theme from "@site/src/theme/muiTheme";
import {
  TopBarBanner,
  TOP_BAR_BANNER,
  isBannerHidden,
} from "@site/src/components/TopBarBanner";

export default function Root({ children }) {
  // Root sits above the route switch, so it mounts once and survives every
  // client navigation. Rendering the banner here (not in the per-route Navbar)
  // keeps it mounted across redirects.
  const { pathname } = useLocation();
  const bannerHidden = isBannerHidden(pathname, TOP_BAR_BANNER.hiddenPaths);
  return (
    <>
      {getInitColorSchemeScript()}
      <CssVarsProvider theme={theme}>
        {!bannerHidden && (
          <TopBarBanner
            zones={TOP_BAR_BANNER.zones}
            rotateIntervalMs={TOP_BAR_BANNER.rotateIntervalMs}
          />
        )}
        {children}
      </CssVarsProvider>
    </>
  );
}
