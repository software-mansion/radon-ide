import React from "react";
import styles from "./styles.module.css";
import { useLocation } from "@docusaurus/router";
import MobileSidebarToggle from "../MobileSidebarToggle";
import NavbarMobileSidebar from "../MobileSidebar";
import NavbarLink from "../NavbarLink";
import Logo from "../../Logo";
import clsx from "clsx";
import NavbarDownloadButton from "../NavbarDownloadButton";
import { useModal } from "../../ModalProvider";

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
];

export default function NavbarContent() {
  const location = useLocation();
  const active = location.pathname;
  const { onOpen } = useModal();

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
                <li
                  key={index}
                  className={clsx({
                    [styles.activeLink]:
                      (item.to.startsWith("/docs") && active.startsWith("/docs")) ||
                      active === item.to,
                  })}>
                  <NavbarLink item={item} />
                </li>
              ) : null
            )}
          </ul>
        </div>
        <MobileSidebarToggle />
        <div className={styles.navbarRight}>
          <a
            href="https://github.com/software-mansion/radon-ide/"
            className={styles.headerGithub}></a>
          <NavbarDownloadButton isMobile={false} onOpen={onOpen} />
        </div>
      </div>
      <NavbarMobileSidebar navbarItems={navbarItems} onOpen={onOpen} />
    </>
  );
}
