import React, { RefObject } from "react";
import styles from "./styles.module.css";

interface NavbarDownloadButtonProps {
  dialogRef: RefObject<HTMLDialogElement>;
  isMobile: boolean;
}
export default function NavbarDownloadButton({ dialogRef, isMobile }: NavbarDownloadButtonProps) {
  const handleDialogOpen = () => {
    dialogRef.current?.showModal();
  };
  return (
    <button
      className={isMobile ? styles.mobileDownload : styles.download}
      onClick={handleDialogOpen}>
      <p>Download</p>
    </button>
  );
}
