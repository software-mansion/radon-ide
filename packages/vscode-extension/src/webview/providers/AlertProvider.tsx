import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import Alert from "../components/shared/Alert";

interface AlertDescriptor {
  id: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  priority?: number; // higher – more important
  type?: "error" | "warning" | "info";
  closeable?: boolean;
}

interface AlertContextProps {
  openAlert: (alert: AlertDescriptor) => void;
  closeAlert: (id: string) => void;
  isOpen: (id: string) => boolean;
}

const AlertContext = createContext<AlertContextProps>({
  openAlert: () => {},
  closeAlert: () => {},
  isOpen: () => false,
});

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertDescriptor[]>([]);

  const isOpen = useCallback(
    (id: string) => {
      return alerts.some((alert) => alert.id === id);
    },
    [alerts]
  );

  const openAlert = useCallback((alertDescriptor: AlertDescriptor) => {
    setAlerts((oldAlerts) => {
      if (oldAlerts.some((alert) => alert.id === alertDescriptor.id)) {
        return oldAlerts;
      }
      return [...oldAlerts, alertDescriptor];
    });
  }, []);

  const closeAlert = useCallback((id: string) => {
    setAlerts((oldAlerts) => oldAlerts.filter((alert) => alert.id !== id));
  }, []);

  const topAlert = getTopAlert(alerts);

  const contextValue = useMemo(() => {
    return { openAlert, isOpen, closeAlert };
  }, [openAlert, isOpen, closeAlert]);

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <Alert
        open={Boolean(topAlert?.id)}
        title={topAlert?.title}
        description={topAlert?.description}
        actions={topAlert?.actions}
        close={topAlert?.closeable ? () => closeAlert(topAlert.id) : undefined}
        type={topAlert?.type ?? "error"}
      />
    </AlertContext.Provider>
  );
}

function getTopAlert(alerts: AlertDescriptor[]) {
  const sorted = [...alerts];

  sorted.sort((a, b) => {
    const aPriority = a.priority ?? 0;
    const bPriority = b.priority ?? 0;

    // only moves higher priority alerts to the end of array
    return aPriority - bPriority;
  });
  return sorted[sorted.length - 1];
}

export function useAlert() {
  const context = React.useContext(AlertContext);

  if (context === undefined) {
    throw new Error("useAlert must be used within a AlertProvider");
  }

  return context;
}

export function useToggleableAlert(open: boolean, alert: AlertDescriptor) {
  const { openAlert, isOpen, closeAlert } = useAlert();
  useEffect(() => {
    if (open && !isOpen(alert.id)) {
      openAlert(alert);
    } else if (!open && isOpen(alert.id)) {
      closeAlert(alert.id);
    }
  }, [open, alert, isOpen, openAlert, closeAlert]);
}
