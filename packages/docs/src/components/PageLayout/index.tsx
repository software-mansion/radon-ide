import React, { ReactNode } from "react";
import styles from "./styles.module.css";

interface PageLayoutProps {
  children: ReactNode;
}
export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className={styles.pageLayout}>
      <div className={`${styles.verticalLine} ${styles.leftLine}`}></div> {/* ✅ */}
      <div className={`${styles.verticalLine} ${styles.rightLine}`}></div> {/* ✅ */}
      <div className={styles.pageContent}>{children}</div>
    </div>
  );
}
