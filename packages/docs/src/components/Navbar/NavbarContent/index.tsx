import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";
import { useLocation } from "@docusaurus/router";
import MobileSidebarToggle from "../MobileSidebarToggle";
import NavbarMobileSidebar from "../MobileSidebar";
import ThemeSwitcher from "../../ThemeSwitcher";
import NavbarLink from "../NavbarLink";
import Logo from "../../Logo";
import clsx from "clsx";
import DownloadModal from "../../DownloadModal";
import NavbarDownloadButton from "../NavbarDownloadButton";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  const active = location.pathname;

  return (
    <>
      <div className={clsx(styles.navbarContainer, "border-layout")}>
        <div className={styles.navbarLeft}>
          <a href="/">
            <Logo className={styles.logo} />
          </a>
        </div>
        <div className={styles.navbarCenter}>
          <ul className={styles.navLinks}>
            {navbarItems.map((item, index) =>
              item.position == "center" ? (
                <li key={index} className={active == item.to ? styles.activeLink : null}>
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
        <div className={styles.navbarRight}>
          <a
            href="https://github.com/software-mansion/radon-ide/"
            className={styles.headerGithub}></a>
          {/* <a
            href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
            className={styles.download}>
            <p>Download</p>
          </a> */}
          <NavbarDownloadButton dialogRef={dialogRef} />
        </div>
      </div>
      <NavbarMobileSidebar navbarItems={navbarItems} isThemeSwitcherShown={isThemeSwitcherShown} />
      <DownloadModal dialogRef={dialogRef} />
    </>
  );
}
