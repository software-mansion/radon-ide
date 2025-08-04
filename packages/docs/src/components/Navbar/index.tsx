import React from "react";
import styles from "./styles.module.css";
import { ColorModeToggle } from "@swmansion/t-rex-ui";
import { useThemeConfig, useColorMode } from "@docusaurus/theme-common";
// import NavbarItem from "../NavbarItem";
import { useHideableNavbar, useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import { translate } from "@docusaurus/Translate";
import clsx from "clsx";

function useNavbarItems() {
  // TODO temporary casting until ThemeConfig type is improved
  return useThemeConfig().navbar.items;
}

export default function Navbar() {
  const {
    navbar: { hideOnScroll, style },
  } = useThemeConfig();
  const mobileSidebar = useNavbarMobileSidebar();
  //   const { navbarRef, isNavbarVisible } = useHideableNavbar(hideOnScroll);
  const { colorMode, setColorMode } = useColorMode();
  const logoLight = useThemeConfig().navbar.logo?.src;
  const logoDark = useThemeConfig().navbar.logo?.srcDark;

  return (
    <nav
      //   ref={navbarRef}
      aria-label={translate({
        id: "theme.NavBar.navAriaLabel",
        message: "Main",
        description: "The ARIA label for the main navigation",
      })}
      className={clsx(
        "navbar",
        // "navbar--fixed-top",
        // isLanding && styles.navbarLanding,
        // hideOnScroll && [styles.navbarHideable, !isNavbarVisible && styles.navbarHidden],
        {
          "navbar--dark": style === "dark",
          "navbar--primary": style === "primary",
          //   "navbar-sidebar--show": mobileSidebar.shown,
        }
      )}>
      <div className={styles.navbar_container}>
        <div className={styles.navbar_left}>
          <a href="/">
            <img src={colorMode === "dark" ? logoDark : logoLight} className={styles.logo}></img>
          </a>
        </div>
        <div className={styles.navbar_center}>
          <ul className={styles.nav_links}>
            <li>
              <a href="/features">Features</a>
            </li>
            <li>
              <a href="/pricing">Pricing</a>
            </li>
            <li>
              <a href="/enterprise">Enterprise</a>
            </li>
            <li>
              <a href="docs/category/getting-started">Docs</a>
            </li>
            <li>
              <a href="/contact">Contact</a>
            </li>
            <li>
              <ColorModeToggle
                onChange={() => {
                  setColorMode(colorMode === "dark" ? "light" : "dark");
                }}
              />
            </li>
          </ul>
        </div>
        <div className={styles.navbar_right}>
          <a href="https://github.com/software-mansion/radon-ide/" className="header-github"></a>
          <a href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide">
            <div className={styles.download}>Download</div>
          </a>
        </div>
      </div>
    </nav>
  );
}
