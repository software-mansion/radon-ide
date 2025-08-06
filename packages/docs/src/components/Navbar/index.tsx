import React from "react";
import styles from "./styles.module.css";
import { ColorModeToggle } from "@swmansion/t-rex-ui";
import { useThemeConfig, useColorMode } from "@docusaurus/theme-common";
import { useHideableNavbar, useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import clsx from "clsx";
import { translate } from "@docusaurus/Translate";
import MobileSidebarToggle from "./MobileSidebarToggle";
import NavbarMobileSidebar from "./MobileSidebar";
import CloseButton from "../CloseButton";

type NavbarCenterItem = {
  label: string;
  to: string;
};
export interface NavbarProps {
  isThemeSwitcherShown?: boolean;
}
const navCenterItems: NavbarCenterItem[] = [
  { label: "Features", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "Enterprise", to: "/enterprise" },
  { label: "Docs", to: "/docs/category/getting-started" },
  { label: "Contact", to: "/contact" },
];

export default function Navbar({ isThemeSwitcherShown }: NavbarProps) {
  const {
    navbar: { style, hideOnScroll, logo, items },
  } = useThemeConfig();
  const mobileSidebar = useNavbarMobileSidebar();
  const { navbarRef, isNavbarVisible } = useHideableNavbar(hideOnScroll);
  const { colorMode, setColorMode } = useColorMode();

  return (
    <>
      <nav
        ref={navbarRef}
        aria-label={translate({
          id: "theme.NavBar.navAriaLabel",
          message: "Main",
          description: "The ARIA label for the main navigation",
        })}
        className={`navbar ${styles.navbar}`}>
        <div className={styles.navbar_container}>
          <div className={styles.navbar_left}>
            <a href="/">
              <img
                // src="https://www.svgrepo.com/show/326119/star-small.svg"
                src={colorMode === "dark" ? logo.srcDark : logo.src}
                className={styles.logo}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
              />
            </a>
          </div>
          <div className={styles.navbar_center}>
            <ul className={styles.nav_links}>
              {navCenterItems.map((item, index) => (
                <li key={index}>
                  <a href={item.to}>{item.label}</a>
                </li>
              ))}
              {isThemeSwitcherShown ? (
                <li>
                  <ColorModeToggle
                    onChange={() => {
                      setColorMode(colorMode === "dark" ? "light" : "dark");
                    }}
                  />
                </li>
              ) : null}
            </ul>
          </div>
          {/* {mobileSidebar.shown ? (
            <CloseButton onClick={mobileSidebar.toggle} />
          ) : (
            <MobileSidebarToggle />
          )} */}
          <MobileSidebarToggle />

          <div className={styles.navbar_right}>
            <a
              href="https://github.com/software-mansion/radon-ide/"
              className={styles.header_github}></a>
            <a href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide">
              <div className={styles.download}>
                <p>Download</p>
              </div>
            </a>
          </div>
        </div>
      </nav>
      <NavbarMobileSidebar />
    </>
  );
}
