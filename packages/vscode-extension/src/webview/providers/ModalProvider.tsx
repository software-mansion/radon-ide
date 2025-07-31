import React, { createContext, useState } from "react";
import Modal from "../components/shared/Modal";

interface ModalOptions {
  title?: string;
  fullScreen?: boolean;
}

interface ModalContextProps {
  openModal: (component: React.ReactNode, options?: ModalOptions) => void;
  closeModal: () => void;
  showHeader: React.Dispatch<React.SetStateAction<boolean>>;
}

const ModalContext = createContext<ModalContextProps>({
  openModal: () => {},
  closeModal: () => {},
  showHeader: () => {},
});

export default function ModalProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState("");
  const [component, setComponent] = useState<React.ReactNode>(<></>);
  const [open, setOpen] = useState(false);
  const [headerShown, showHeader] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const openModal = (modalComponent: React.ReactNode, options?: ModalOptions) => {
    setComponent(modalComponent);
    setOpen(true);

    if (options?.title) {
      setTitle(options.title);
    }
    if (options?.fullScreen) {
      setIsFullScreen(options.fullScreen);
    }
  };

  const closeModal = () => {
    setOpen(false);
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal, showHeader }}>
      {children}
      <Modal
        title={title}
        component={component}
        open={open}
        setOpen={setOpen}
        headerShown={headerShown}
        isFullScreen={isFullScreen}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = React.useContext(ModalContext);

  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }

  return context;
}
