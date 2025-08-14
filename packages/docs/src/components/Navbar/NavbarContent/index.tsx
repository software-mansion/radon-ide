import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";
import { useLocation } from "@docusaurus/router";
import MobileSidebarToggle from "../MobileSidebarToggle";
import NavbarMobileSidebar from "../MobileSidebar";
import ThemeSwitcher from "../../ThemeSwitcher";
import NavbarLink from "../NavbarLink";
import Logo from "../../Logo";
import clsx from "clsx";
import CloseIcon from "../../CloseIcon";
import DownloadButtons from "../../DownloadButtons";

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

  const handleDialogOpen = () => {
    dialogRef.current?.showModal();
  };
  const handleDialogClose = () => {
    dialogRef.current?.close();
  };

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
          <a
            href="https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide"
            className={styles.download}>
            <p>Download</p>
          </a>
          <button className={styles.download} onClick={handleDialogOpen}>
            <p>Download</p>
          </button>
        </div>
      </div>
      <NavbarMobileSidebar navbarItems={navbarItems} isThemeSwitcherShown={isThemeSwitcherShown} />
      <dialog className={styles.modalContainer} ref={dialogRef} onClick={handleDialogClose}>
        <div className={styles.modalHead}>
          <p>Download</p>
          <button onClick={handleDialogClose} className={styles.dialogCloseButton}>
            <CloseIcon />
          </button>
        </div>
        <p className={styles.modalSubheading}>Choose how you want to use Radon IDE:</p>
        <DownloadButtons vertical={true} />
      </dialog>
    </>
  );
}
