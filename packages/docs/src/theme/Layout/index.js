import React from "react";
import ErrorBoundary from "@docusaurus/ErrorBoundary";
import { PageMetadata } from "@docusaurus/theme-common";
import { useKeyboardNavigation } from "@docusaurus/theme-common/internal";
import SkipToContent from "@theme/SkipToContent";
import AnnouncementBar from "@theme/AnnouncementBar";
import Navbar from "@theme/Navbar";
import Footer from "@theme/Footer";
import LayoutProvider from "@theme/Layout/Provider";
import ErrorPageContent from "@theme/ErrorPageContent";
import styles from "./styles.module.css";
import clsx from "clsx";

export default function LayoutWrapper({ children, noFooter, title, description }) {
  useKeyboardNavigation();
  return (
    <LayoutProvider>
      <PageMetadata title={title} description={description} />

      <SkipToContent />

      <AnnouncementBar />

      <Navbar />

      <ErrorBoundary fallback={(params) => <ErrorPageContent {...params} />}>
        {children}
      </ErrorBoundary>
      <div className={styles.spacer}>
        <div className={clsx(styles.spacerBorder, "border-layout")}></div>
      </div>

      {!noFooter && <Footer />}
    </LayoutProvider>
  );
}
