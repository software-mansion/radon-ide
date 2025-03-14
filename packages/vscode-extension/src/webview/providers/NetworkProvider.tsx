import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";
import useNetworkTracker, {
  NetworkTracker,
  networkTrackerInitialState,
} from "../hooks/useNetworkTracker";

type TimestampRange = {
  start: number;
  end: number;
};

interface Filters {
  timestampRange?: TimestampRange;
}

interface NetworkProviderProps extends NetworkTracker {
  isRecording: boolean;
  showFilter: boolean;
  filters: Filters;
  isClearing: boolean;
  isScrolling: boolean;
  toggleRecording: () => void;
  toggleShowFilter: () => void;
  setFilters: (filters: Filters) => void;
  clearActivity: () => void;
  toggleScrolling: () => void;
}

const NetworkContext = createContext<NetworkProviderProps>({
  ...networkTrackerInitialState,
  isRecording: true,
  showFilter: false,
  filters: {
    timestampRange: undefined,
  },
  isClearing: false,
  isScrolling: false,
  toggleRecording: () => {},
  toggleShowFilter: () => {},
  setFilters: () => {},
  clearActivity: () => {},
  toggleScrolling: () => {},
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();

  const [isRecording, setIsRecording] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    timestampRange: undefined,
  });

  function toggleRecording() {
    console.log("Toggling recording");
    setIsRecording(!isRecording);
  }

  function toggleShowFilter() {
    console.log("Toggling show filter");
    setShowFilter(!showFilter);
  }

  function clearActivity() {
    setIsClearing(!isClearing);
    console.log("Clearing activity");
  }

  function toggleScrolling() {
    console.log("Toggling scrolling");
    setIsScrolling(!isScrolling);
  }

  const contextValue = useMemo(() => {
    return {
      ...networkTracker,
      isRecording,
      filters,
      showFilter,
      isClearing,
      isScrolling,
      toggleRecording,
      toggleShowFilter,
      setFilters,
      clearActivity,
      toggleScrolling,
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
