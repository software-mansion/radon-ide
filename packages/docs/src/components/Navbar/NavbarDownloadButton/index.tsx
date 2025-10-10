import React from "react";
import styles from "./styles.module.css";
import { track } from "@vercel/analytics";

interface NavbarDownloadButtonProps {
  isMobile: boolean;
  onOpen: () => void;
}
export default function NavbarDownloadButton({ isMobile, onOpen }: NavbarDownloadButtonProps) {
  const handleNavbarCTA = () => {
    track("Navbar CTA");
  };

  const handleDialogOpen = () => {
    handleNavbarCTA();
    onOpen();
  };
  return (
    <button
      className={isMobile ? styles.mobileDownload : styles.download}
      onClick={handleDialogOpen}>
      <p>Download</p>
    </button>
  );
}
