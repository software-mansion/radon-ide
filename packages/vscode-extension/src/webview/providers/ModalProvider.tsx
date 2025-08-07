import React, { createContext, useState } from "react";
import Modal from "../components/shared/Modal";

interface ModalState {
  title: string;
  component: React.ReactNode;
  open: boolean;
  headerShown: boolean;
  fullscreen: boolean;
}

interface ModalOptions {
  title?: string;
  fullscreen?: boolean;
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
  const [state, setState] = useState<ModalState | null>(null);

  const openModal = (modalComponent: React.ReactNode, options?: ModalOptions) => {
    setState({
      title: options?.title ?? "",
      component: modalComponent,
      open: true,
      headerShown: true,
      fullscreen: options?.fullscreen || false,
    });
  };

  const closeModal = () => {
    setState(null);
  };

  const showHeader = (value: boolean) => {
    if (state === null) {
      return;
    }
    setState({ ...state, headerShown: value });
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal, showHeader }}>
      {children}
      {state !== null && (
        <Modal
          title={state.title}
          component={state.component}
          isOpen={state.open}
          onClose={closeModal}
          headerShown={state.headerShown}
          fullscreen={state.fullscreen}
        />
      )}
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
