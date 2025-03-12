import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

interface NetworkProviderProps {
  isRecording: boolean;
  showFilter: boolean;
  filters: Filters;
  toggleRecording: () => void;
  toggleShowFilter: () => void;
  setFilters: (filters: Filters) => void;
  clearActivity: () => void;
}

enum RequestType {
  All = "all",
  XHR = "xhr",
  Image = "image",
  Script = "script",
  CSS = "css",
  Font = "font",
  Media = "media",
  Manifest = "manifest",
  WebSocket = "ws",
  WebAssembly = "wasm",
  Other = "other",
}

interface Filters {
  requestType: RequestType;
}

const NetworkContext = createContext<NetworkProviderProps>({
  isRecording: true,
  showFilter: false,
  filters: {
    requestType: RequestType.All,
  },
  toggleRecording: () => {},
  toggleShowFilter: () => {},
  setFilters: () => {},
  clearActivity: () => {},
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const [isRecording, setIsRecording] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    requestType: RequestType.All,
  });

  function toggleRecording() {
    setIsRecording(!isRecording);
  }

  function toggleShowFilter() {
    setShowFilter(!showFilter);
  }

  function clearActivity() {
    console.log("Clearing activity");
  }

  const contextValue = useMemo(() => {
    return {
      isRecording,
      filters,
      showFilter,
      toggleRecording,
      toggleShowFilter,
      setFilters,
      clearActivity,
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
