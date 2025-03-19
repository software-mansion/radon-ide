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
  url?: string;
}

interface NetworkProviderProps extends NetworkTracker {
  isRecording: boolean;
  showSearch: boolean;
  filters: Filters;
  isClearing: boolean;
  isScrolling: boolean;
  showChart: boolean;
  toggleRecording: () => void;
  toggleShowSearch: () => void;
  setFilters: (filters: Filters) => void;
  clearActivity: () => void;
  toggleScrolling: () => void;
  toggleShowChart: () => void;
}

const NetworkContext = createContext<NetworkProviderProps>({
  ...networkTrackerInitialState,
  isRecording: true,
  showSearch: false,
  filters: {
    url: undefined,
    timestampRange: undefined,
  },
  isClearing: false,
  isScrolling: false,
  showChart: true,
  toggleRecording: () => {},
  toggleShowSearch: () => {},
  setFilters: () => {},
  clearActivity: () => {},
  toggleScrolling: () => {},
  toggleShowChart: () => {},
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();

  const [showChart, setShowChart] = useState(true);
  const [isRecording, setIsRecording] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    timestampRange: undefined,
    url: undefined,
  });

  function toggleRecording() {
    setIsRecording((prev) => !prev);
    networkTracker.toggleNetwork(isRecording);
  }

  function toggleShowSearch() {
    setShowSearch((prev) => !prev);
  }

  function clearActivity() {
    setIsClearing((prev) => prev);
    networkTracker.clearLogs();
    setIsClearing(false);
  }

  function toggleScrolling() {
    setIsScrolling((prev) => !prev);
  }

  function toggleShowChart() {
    setShowChart((prev) => !prev);
  }

  const networkLogs = useMemo(() => {
    const filteredLogs = networkTracker.networkLogs.filter((log) => {
      const matchesUrl = filters.url ? log.request?.url.includes(filters.url) : true;
      const matchesTimestampRange = filters.timestampRange
        ? log.timeline.timestamp >= filters.timestampRange.start &&
          log.timeline.timestamp <= filters.timestampRange.end
        : true;
      return matchesUrl && matchesTimestampRange;
    });
    return filteredLogs;
  }, [networkTracker.networkLogs, filters]);

  const contextValue = useMemo(() => {
    return {
      ...networkTracker,
      networkLogs,
      isRecording,
      filters,
      showSearch,
      isClearing,
      isScrolling,
      showChart,
      toggleRecording,
      toggleShowSearch,
      setFilters,
      clearActivity,
      toggleScrolling,
      toggleShowChart,
    };
  }, [isRecording, filters, showSearch, isClearing, isScrolling, showChart, networkLogs]);

  return <NetworkContext.Provider value={contextValue}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }

  return context;
}
