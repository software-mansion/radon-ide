import React from "react";
import styles from "./styles.module.css";
import { translate } from "@docusaurus/Translate";

export interface NavbarLayoutProps {
  children: React.ReactNode;
}

export default function NavbarLayout({ children }: NavbarLayoutProps) {
  return (
    <nav
      aria-label={translate({
        id: "theme.NavBar.navAriaLabel",
        message: "Main",
        description: "The ARIA label for the main navigation",
      })}
      className={`navbar ${styles.navbar}`}>
      {children}
    </nav>
  );
}
