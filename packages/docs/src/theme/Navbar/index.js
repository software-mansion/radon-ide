import useBaseUrl from "@docusaurus/useBaseUrl";
import React from "react";
import Navbar from "../../components/Navbar";

import { Analytics } from "@vercel/analytics/react";

export default function NavbarWrapper(props) {
  const heroImages = {
    logo: useBaseUrl("/img/logo.svg"),
  };
  return (
    <>
      <Navbar />
      <Analytics />
    </>
  );
}
