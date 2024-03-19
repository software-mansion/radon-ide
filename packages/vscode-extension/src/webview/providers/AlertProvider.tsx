import React, { createContext, useCallback, useState } from "react";
import Alert from "../components/shared/Alert";

interface AlertType {
  id: string;
  title: string;
  description?: string;
  actions: React.ReactNode;
}

interface AlertContextProps {
  openAlert: (alert: AlertType) => void;
  closeAlert: (id: string) => void;
  isOpen: (id: string) => boolean;
}

const AlertContext = createContext<AlertContextProps>({
  openAlert: () => {},
  closeAlert: () => {},
  isOpen: () => false,
});

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertType[]>([]);

  const isOpen = useCallback(
    (id: string) => {
      return alerts.some((alert) => alert.id === id);
    },
    [alerts]
  );

  const openAlert = useCallback(({ id, title, description, actions }: AlertType) => {
    setAlerts((alerts) => {
      if (alerts.some((alert) => alert.id === id)) {
        return alerts;
      }
      return [...alerts, { id, title, description, actions }];
    });
  }, []);

  const closeAlert = useCallback((id: string) => {
    setAlerts((alerts) => alerts.filter((alert) => alert.id !== id));
  }, []);

  const topAlert = alerts[alerts.length - 1];

  return (
    <AlertContext.Provider value={{ openAlert, isOpen, closeAlert }}>
      {children}
      <Alert
        open={Boolean(topAlert?.id)}
        title={topAlert?.title}
        description={topAlert?.description}
        actions={topAlert?.actions}
        type="error"
      />
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
