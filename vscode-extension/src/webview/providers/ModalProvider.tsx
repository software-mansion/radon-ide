import React, { createContext, useState } from "react";
import Modal from "../components/shared/Modal";

interface ModalContextProps {
  openModal: (title: string, component: React.ReactNode) => void;
}

const ModalContext = createContext<ModalContextProps>({
  openModal: () => {},
});

export default function ModalProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState("");
  const [component, setComponent] = useState(<></>);
  const [open, setOpen] = useState(false);

  const openModal = (title: string, component: React.ReactNode) => {
    setTitle(title);
    // @ts-ignore TODO see this further but i think it's fine
    setComponent(component);
    setOpen(true);
  };

  return (
    <ModalContext.Provider value={{ openModal }}>
      {children} <Modal title={title} component={component} open={open} setOpen={setOpen} />
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
