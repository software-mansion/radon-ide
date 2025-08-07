import React from "react";
import styles from "./styles.module.css";
import { useNavbarMobileSidebar, useLockBodyScroll } from "@docusaurus/theme-common/internal";
import clsx from "clsx";
import { NavbarItem } from "../NavbarContent";
import ThemeSwitcher from "../../ThemeSwitcher";

interface NavbarMobileSidebarProps {
  navbarItems: NavbarItem[];
  isThemeSwitcherShown: boolean;
}

export default function NavbarMobileSidebar({
  navbarItems,
  isThemeSwitcherShown,
}: NavbarMobileSidebarProps) {
  const mobileSidebar = useNavbarMobileSidebar();
  useLockBodyScroll(mobileSidebar.shown);
  if (!mobileSidebar.shouldRender) {
    return null;
  }

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
        <li>
          <ThemeSwitcher isThemeSwitcherShown={isThemeSwitcherShown} />
        </li>
      </ul>
    </aside>
  );
}
