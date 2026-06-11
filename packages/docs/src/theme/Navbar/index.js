import React from "react";
import Navbar from "../../components/Navbar";

import { Analytics } from "@vercel/analytics/react";

export default function NavbarWrapper() {
  return (
    <>
      <Navbar />
      <Analytics />
    </>
  );
}
