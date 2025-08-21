import React from "react";
import styles from "./styles.module.css";

interface NavbarDownloadButtonProps {
  isMobile: boolean;
  onOpen: () => void;
}
export default function NavbarDownloadButton({ isMobile, onOpen }: NavbarDownloadButtonProps) {
  const handleDialogOpen = () => {
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
