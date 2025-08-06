import React from "react";
import styles from "./styles.module.css";
import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import clsx from "clsx";
import { NavbarItem } from "../index";

interface NavbarMobileSidebarProps {
  navbarItems: NavbarItem[];
}

export default function NavbarMobileSidebar({ navbarItems }: NavbarMobileSidebarProps) {
  const mobileSidebar = useNavbarMobileSidebar();

  return (
    <aside
      className={clsx(styles.container, {
        [styles.open]: mobileSidebar.shown,
      })}
      aria-hidden={!mobileSidebar.shown}>
      <ul className={styles.mobileNavLinks}>
        {navbarItems.map((item, idx) => (
          <li key={idx}>
            <a href={item.to} onClick={mobileSidebar.toggle}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
