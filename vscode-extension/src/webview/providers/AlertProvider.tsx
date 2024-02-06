import React, { createContext, useState } from "react";
import Alert from "../components/shared/Alert";

interface AlertType {
  title: string;
  description?: string;
  actions: React.ReactNode;
}

interface AlertContextProps {
  openAlert: (alert: AlertType) => void;
  closeAlert: () => void;
  isOpen: boolean;
}

const AlertContext = createContext<AlertContextProps>({
  openAlert: () => {},
  closeAlert: () => {},
  isOpen: false,
});

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [actions, setActions] = useState<React.ReactNode>(null);

  const openAlert = ({ title, description, actions }: AlertType) => {
    setTitle(title);
    setDescription(description);
    setActions(actions);
    setOpen(true);
  };

  const closeAlert = () => {
    setOpen(false);
  };

  return (
    <AlertContext.Provider value={{ openAlert, isOpen: open, closeAlert }}>
      {children}
      <Alert open={open} title={title} description={description} actions={actions} type="error" />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = React.useContext(AlertContext);

  if (context === undefined) {
    throw new Error("useAlert must be used within a AlertProvider");
  }

  return context;
}
