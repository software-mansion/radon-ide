import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

interface NetworkProviderProps {
  isRecording: boolean;
  filters: Filters | null;
  toggleRecording: () => void;
  setFilters: (filters: Filters) => void;
}

enum RequestType {
  XHR = "xhr",
  Image = "image",
  Script = "script",
  CSS = "css",
  Font = "font",
  Media = "media",
}

interface Filters {
  requestType: RequestType;
}

const NetworkContext = createContext<NetworkProviderProps>({
  isRecording: true,
  filters: null,
  toggleRecording: () => {},
  setFilters: () => {},
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const [isRecording, setIsRecording] = useState(true);
  const [filters, setFilters] = useState<Filters | null>(null);

  function toggleRecording() {
    console.log("Toggling recording");
    setIsRecording(!isRecording);
  }

  const contextValue = useMemo(() => {
    return {
      isRecording,
      filters,
      toggleRecording,
      setFilters,
    };
  }, [isRecording, toggleRecording, setFilters, filters]);

  return <NetworkContext.Provider value={contextValue}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
