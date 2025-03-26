import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
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

  const [showChart, toggleShowChart] = useReducer((state) => !state, true);
  const [isRecording, toggleRecording] = useReducer((state) => !state, true);
  const [showSearch, toggleShowSearch] = useReducer((state) => !state, false);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);
  const [filters, setFilters] = useState<Filters>({
    timestampRange: undefined,
    url: undefined,
  });

  useEffect(() => {
    networkTracker.toggleNetwork(isRecording);
  }, [isRecording]);

  function clearActivity() {
    networkTracker.clearLogs();
  }

  const networkLogs = useMemo(() => {
    return networkTracker.networkLogs.filter((log) => {
      const { url, timestampRange } = filters;

      const matchesUrl = !url || log.request?.url.includes(url);
      const matchesTimestampRange =
        !timestampRange ||
        (log.timeline.timestamp >= timestampRange.start &&
          log.timeline.timestamp <= timestampRange.end);

      return matchesUrl && matchesTimestampRange;
    });
  }, [networkTracker.networkLogs, filters]);

  const contextValue = useMemo(() => {
    return {
      ...networkTracker,
      networkLogs,
      isRecording,
      filters,
      showSearch,
      isScrolling,
      showChart,
      toggleRecording,
      toggleShowSearch,
      setFilters,
      clearActivity,
      toggleScrolling,
      toggleShowChart,
    };
  }, [isRecording, filters, showSearch, isScrolling, showChart, networkLogs]);

  return <NetworkContext.Provider value={contextValue}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }

  return context;
}
