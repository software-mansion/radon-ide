import React, { RefObject, useRef } from "react";
import styles from "./styles.module.css";
import DownloadButtons from "../DownloadButtons";
import CloseIcon from "../CloseIcon";

interface DownloadButtonProps {
  dialogRef: RefObject<HTMLDialogElement>;
}

export default function DownloadModal({ dialogRef }: DownloadButtonProps) {
  const handleDialogClose = () => {
    dialogRef.current?.close();
  };
  return (
    <dialog className={styles.modalContainer} ref={dialogRef} onClick={handleDialogClose}>
      <div className={styles.modalHead}>
        <p>Download</p>
        <button onClick={handleDialogClose} className={styles.dialogCloseButton}>
          <CloseIcon />
        </button>
      </div>
      <p className={styles.modalSubheading}>Choose how you want to use Radon IDE:</p>
      <DownloadButtons vertical={true} />
    </dialog>
  );
}
