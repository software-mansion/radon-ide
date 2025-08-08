import React from "react";
import styles from "./styles.module.css";

interface FooterLayoutProps {
  children: React.ReactNode;
}

export default function FooterLayout({ children }: FooterLayoutProps) {
  return <footer className={styles.containerWrapper}>{children}</footer>;
}
