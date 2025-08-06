import React from "react";
import { NavbarItem } from "../Navbar/index";

export default function NavbarItems({ navbarItems }: { navbarItems: NavbarItem[] }) {
  return (
    <>
      {navbarItems.map((item, index) =>
        item.position == "center" ? (
          <li key={index}>
            <a href={item.to}>{item.label}</a>
          </li>
        ) : null
      )}
    </>
  );
}
