import React from "react";
import styles from "./styles.module.css";
import { track } from "@vercel/analytics";

interface NavbarDownloadButtonProps {
  isMobile: boolean;
  onOpen: (trackForm: string) => void;
}
export default function NavbarDownloadButton({ isMobile, onOpen }: NavbarDownloadButtonProps) {
  const handleNavbarDownload = () => {
    track("Navbar download button");
    onOpen("Navbar modal");
  };

  return (
    <button
      className={isMobile ? styles.mobileDownload : styles.download}
      onClick={handleNavbarDownload}>
      <p>Download</p>
    </button>
  );
}
