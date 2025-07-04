import useBaseUrl from "@docusaurus/useBaseUrl";
import React from "react";
import { Navbar } from "@swmansion/t-rex-ui";
import { Analytics } from "@vercel/analytics/react";
import Head from "@docusaurus/Head";

const isProduction = process.env.NODE_ENV === "production";

// Scripts component to include additional scripts in <head>
// Note: Google Tag Manager is handled by Docusaurus preset, so we don't need to include it here.
function Scripts() {
  if (isProduction) {
    return (
      <Head>
        {/* CookieScript */}
        <script
          type="text/javascript"
          charset="UTF-8"
          src="//cdn.cookie-script.com/s/b0724133a2e949a319ce96eb3f7febf6.js"></script>
        {/* Reddit Pixel */}
        <script src={useBaseUrl("/js/reddit-pixel.js")}></script>
      </Head>
    );
  }
  return null;
}

export default function NavbarWrapper(props) {
  const heroImages = {
    logo: useBaseUrl("/img/logo.svg"),
  };
  return (
    <>
      <Navbar
        isAlgoliaActive={true}
        isThemeSwitcherShown={false}
        heroImages={heroImages}
        {...props}
      />
      <Scripts />
      <Analytics />
    </>
  );
}
