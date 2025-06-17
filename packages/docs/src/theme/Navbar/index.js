import useBaseUrl from "@docusaurus/useBaseUrl";
import React from "react";
import { Navbar } from "@swmansion/t-rex-ui";
import { Analytics } from "@vercel/analytics/react";
import Head from "@docusaurus/Head";

const isProduction = process.env.NODE_ENV === "production";

function RedditPixel() {
  if (isProduction) {
    return (
      <Head>
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
      <RedditPixel />
      <Analytics />
    </>
  );
}
