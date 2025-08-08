import React from "react";
import styles from "./styles.module.css";

export interface NavbarLayoutProps {
  children: React.ReactNode;
}

export default function NavbarLayout({ children }: NavbarLayoutProps) {
  return (
    <nav aria-label="Naigation bar" className={`navbar ${styles.navbar}`}>
      {children}
    </nav>
  );
}
