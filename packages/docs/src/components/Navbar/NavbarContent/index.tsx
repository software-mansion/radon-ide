import React from "react";
import styles from "./styles.module.css";
import { useThemeConfig, useColorMode } from "@docusaurus/theme-common";
import MobileSidebarToggle from "../MobileSidebarToggle";
import NavbarMobileSidebar from "../MobileSidebar";
import ThemeSwitcher from "../../ThemeSwitcher";
import NavbarLink from "../NavbarLink";

export interface NavbarItem {
  label: string;
  to: string;
  position?: "left" | "center" | "right";
}

const navbarItems: NavbarItem[] = [
  { label: "Features", to: "/features", position: "center" },
  { label: "Pricing", to: "/pricing", position: "center" },
  { label: "Enterprise", to: "/enterprise", position: "center" },
  { label: "Docs", to: "/docs/category/getting-started", position: "center" },
  { label: "Contact", to: "/contact", position: "center" },
  { label: "GitHub", to: "https://github.com/software-mansion/radon-ide/", position: "right" },
  {
    label: "Download",
    to: "https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide",
    position: "right",
  },
];

export interface NavbarContentProps {
  isThemeSwitcherShown?: boolean;
}

export default function NavbarContent({ isThemeSwitcherShown }: NavbarContentProps) {
  const {
    navbar: { logo },
  } = useThemeConfig();
  const { colorMode, setColorMode } = useColorMode();
  return (
    <>
      <div className={styles.navbar_container}>
        <div className={styles.navbar_left}>
          <a href="/">
            <img
              src={colorMode === "dark" ? `/${logo.srcDark}` : `/${logo.src}`}
              className={styles.logo}
              alt={logo.alt}
            />
          </a>
        </div>
        <div className={styles.navbar_center}>
          <ul className={styles.nav_links}>
            {navbarItems.map((item, index) =>
              item.position == "center" ? (
                <li key={index}>
                  <NavbarLink item={item} />
                </li>
              ) : null
            )}
            <ThemeSwitcher isThemeSwitcherShown={isThemeSwitcherShown} />
          </ul>
        </div>
        {/* To be changed */}
        <MobileSidebarToggle />
        {/* --------------- */}
        <div className={styles.navbar_right}>
          <a
            href="https://github.com/software-mansion/radon-ide/"
            className={styles.header_github}></a>
          <a
            href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
            className={styles.download}>
            <p>Download</p>
          </a>
        </div>
      </div>
      <NavbarMobileSidebar navbarItems={navbarItems} isThemeSwitcherShown={isThemeSwitcherShown} />
    </>
  );
}
