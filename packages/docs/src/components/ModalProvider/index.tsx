import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from "react";
import styles from "./styles.module.css";
import CloseIcon from "../CloseIcon";
import DownloadButtons from "../DownloadButtons";

type ModalContextType = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  return context;
};

type ModalProviderProps = {
  children: ReactNode;
};

export function ModalProvider({ children }: ModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClose = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <ModalContext.Provider value={{ isOpen, onOpen, onClose }}>
      {children}
      <dialog ref={dialogRef} className={styles.modalContainer} onClick={handleBackdropClose}>
        <div className={styles.modalHead}>
          <p>Download</p>
          <button onClick={onClose} className={styles.dialogCloseButton}>
            <CloseIcon />
          </button>
        </div>
        <p className={styles.modalSubheading}>Choose how you want to use Radon IDE:</p>
        <DownloadButtons vertical={true} />
      </dialog>
    </ModalContext.Provider>
  );
}
