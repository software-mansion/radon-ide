import React, { RefObject } from "react";
import styles from "./styles.module.css";

interface NavbarDownloadButtonProps {
  dialogRef: RefObject<HTMLDialogElement>;
}
export default function NavbarDownloadButton({ dialogRef }: NavbarDownloadButtonProps) {
  const handleDialogOpen = () => {
    dialogRef.current?.showModal();
  };
  return (
    <button className={styles.download} onClick={handleDialogOpen}>
      <p>Download</p>
    </button>
  );
}
