import React from "react";
import styles from "./styles.module.css";
import { ColorModeToggle } from "@swmansion/t-rex-ui";
import { useThemeConfig, useColorMode } from "@docusaurus/theme-common";
import { translate } from "@docusaurus/Translate";
import MobileSidebarToggle from "./MobileSidebarToggle";
import NavbarMobileSidebar from "./MobileSidebar";
import NavbarItems from "../NavbarItems";
import ThemeSwitcher from "../ThemeSwitcher";

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

export interface NavbarProps {
  isThemeSwitcherShown?: boolean;
}

export default function Navbar({ isThemeSwitcherShown }: NavbarProps) {
  const {
    navbar: { logo },
  } = useThemeConfig();
  const { colorMode, setColorMode } = useColorMode();

  return (
    <>
      <nav
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
                // src="../../img/logo-dark.svg"
                src={colorMode === "dark" ? logo.srcDark : logo.src}
                className={styles.logo}
                alt={logo.alt}
              />
            </a>
          </div>
          <div className={styles.navbar_center}>
            <ul className={styles.nav_links}>
              {/* {navbarItems.map((item, index) =>
                item.position == "center" ? (
                  <li key={index}>
                    <a href={item.to}>{item.label}</a>
                  </li>
                ) : null
              )} */}
              <NavbarItems navbarItems={navbarItems} />
              <ThemeSwitcher isThemeSwitcherShown={isThemeSwitcherShown} />

              {/* {isThemeSwitcherShown ? (
                <li>
                  <ColorModeToggle
                    onChange={() => {
                      setColorMode(colorMode === "dark" ? "light" : "dark");
                    }}
                  />
                </li>
              ) : null} */}
            </ul>
          </div>

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
      <NavbarMobileSidebar navbarItems={navbarItems} />
    </>
  );
}
