import React from "react";
import NavbarLayout from "@theme/Navbar/Layout";
import NavbarContent from "@theme/Navbar/Content";
import { Analytics } from "@vercel/analytics/react";

export default function Navbar() {
  return (
    <NavbarLayout>
      <NavbarContent />
      <Analytics />
    </NavbarLayout>
  );
}
