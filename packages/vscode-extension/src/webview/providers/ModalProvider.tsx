import React, { createContext, useState } from "react";
import Modal from "../components/shared/Modal";

interface ModalState {
  title: string;
  component: React.ReactNode;
  open: boolean;
  headerShown: boolean;
  isFullScreen: boolean;
}

interface ModalOptions {
  title?: string;
  fullScreen?: boolean;
}

interface ModalContextProps {
  openModal: (component: React.ReactNode, options?: ModalOptions) => void;
  closeModal: () => void;
  showHeader: (value: boolean) => void;
}

const ModalContext = createContext<ModalContextProps>({
  openModal: () => {},
  closeModal: () => {},
  showHeader: () => {},
});

export default function ModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModalState>({
    title: "",
    component: <></>,
    open: false,
    headerShown: true,
    isFullScreen: false,
  });

  const openModal = (modalComponent: React.ReactNode, options?: ModalOptions) => {
    setState({
      title: options?.title ?? "",
      component: modalComponent,
      open: true,
      headerShown: true,
      isFullScreen: options?.fullScreen || false,
    });
  };

  const closeModal = () => {
    setState({
      title: "",
      component: null,
      open: false,
      headerShown: true,
      isFullScreen: false,
    });
  };

  const showHeader = (value: boolean) => {
    setState((prevState) => ({
      ...prevState,
      headerShown: value,
    }));
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal, showHeader }}>
      {children}
      <Modal
        title={state.title}
        component={state.component}
        isOpen={state.open}
        onClose={closeModal}
        headerShown={state.headerShown}
        isFullScreen={state.isFullScreen}
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
