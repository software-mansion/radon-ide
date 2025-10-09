import React from "react";
import { NavbarItem } from "../NavbarContent";

export interface NavbarLinkProps {
  item: NavbarItem;
  onClick?: () => void;
}

export default function NavbarLink({ item, onClick }: NavbarLinkProps) {
  return (
    <a href={item.to} onClick={onClick}>
      {item.label}
    </a>
  );
}
