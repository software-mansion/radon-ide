import React from "react";
import NavbarContent from "./NavbarContent";
import styles from "./styles.module.css";

export default function Navbar() {
  return (
    <nav aria-label="Naigation bar" className={`navbar ${styles.navbar}`}>
      <NavbarContent />
    </nav>
  );
}
