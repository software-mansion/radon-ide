import React from "react";
import NavbarContent from "./NavbarContent";
import NavbarLayout from "./NavbarLayout";

export interface NavbarProps {
  isThemeSwitcherShown?: boolean;
}

export default function Navbar({ isThemeSwitcherShown }: NavbarProps) {
  return (
    <NavbarLayout>
      <NavbarContent isThemeSwitcherShown={isThemeSwitcherShown} />
    </NavbarLayout>
  );
}
