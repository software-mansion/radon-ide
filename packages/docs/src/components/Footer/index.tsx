import React from "react";
import styles from "./styles.module.css";
import { useThemeConfig } from "@docusaurus/theme-common";
import Logo from "../Logo";
import clsx from "clsx";
import FooterNavigation from "./FooterNavigation";
import GitHubIcon from "../GitHubIcon";
import YouTubeIcon from "../YouTubeIcon";
import XIcon from "../XIcon";
import ThemeSwitcher from "../ThemeSwitcher";

export default function Footer() {
  const {
    footer: { copyright },
  } = useThemeConfig();
  return (
    <footer className={styles.containerWrapper}>
      <div className={clsx(styles.container, "border-layout")}>
        <div className={styles.left}>
          <div className={styles.brandContainer}>
            <Logo className={styles.logo} />
            <div className={styles.brandInfo}>
              <div className={styles.brand}>
                © 2025 <a href="https://swmansion.com/">Software Mansion</a>
              </div>
              <p className={styles.copyright}>{copyright}</p>
            </div>
          </div>
          <div className={styles.socialMedia}>
            <a
              href="https://www.youtube.com/@SoftwareMansion"
              target="_blank"
              className={styles.icon}>
              <YouTubeIcon />
            </a>
            <a href="https://x.com/swmansion" target="_blank" className={styles.icon}>
              <XIcon />
            </a>
            <a
              href="https://github.com/software-mansion/radon-ide/"
              target="_blank"
              className={styles.icon}>
              <GitHubIcon />
            </a>
          </div>
        </div>
        <div className={styles.right}>
          <FooterNavigation />
        </div>
        <ThemeSwitcher isThemeSwitcherShown={true} />
      </div>
    </footer>
  );
}
