import React from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { DocSidebar } from "@swmansion/t-rex-ui";

export default function DocSidebarWrapper(props) {
  const heroImages = {
    logo: useBaseUrl("/img/logo.svg"),
  };
  return (
    <>
      <DocSidebar heroImages={heroImages} {...props} />
    </>
  );
}
