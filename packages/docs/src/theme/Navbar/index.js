import useBaseUrl from "@docusaurus/useBaseUrl";
import React from "react";
import { Navbar } from "@swmansion/t-rex-ui";
import { Analytics } from "@vercel/analytics/react";

export default function NavbarWrapper(props) {
  const heroImages = {
    logo: useBaseUrl("/img/logo.svg"),
  };
  return (
    <>
      <Navbar
        isAlgoliaActive={false}
        isThemeSwitcherShown={false}
        heroImages={heroImages}
        {...props}
      />
      <Analytics />
    </>
  );
}
