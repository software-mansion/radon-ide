import { createContext, PropsWithChildren, useContext, useMemo, useReducer, useState } from "react";
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
  unfilteredNetworkLogs: NetworkTracker["networkLogs"];
  isRecording: boolean;
  filters: Filters;
  isScrolling: boolean;
  toggleRecording: () => void;
  setFilters: (filters: Filters) => void;
  clearActivity: () => void;
  toggleScrolling: () => void;
  isSearchVisible: boolean;
  toggleSearchVisible: () => void;
  isTimelineVisible: boolean;
  toggleTimelineVisible: () => void;
}

const NetworkContext = createContext<NetworkProviderProps>({
  ...networkTrackerInitialState,
  unfilteredNetworkLogs: [],
  isRecording: true,
  isSearchVisible: false,
  filters: {
    url: undefined,
    timestampRange: undefined,
  },
  isScrolling: false,
  toggleRecording: () => {},
  toggleSearchVisible: () => {},
  setFilters: () => {},
  clearActivity: () => {},
  toggleScrolling: () => {},
  isTimelineVisible: true,
  toggleTimelineVisible: () => {},
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();

  const [isTimelineVisible, toggleTimelineVisible] = useReducer((state) => !state, true);
  const [isSearchVisible, toggleSearchVisible] = useReducer((state) => !state, false);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);

  const [isRecording, setIsRecording] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    timestampRange: undefined,
    url: undefined,
  });

  const clearActivity = () => {
    networkTracker.clearLogs();
  };

  const toggleRecording = () => {
    setIsRecording((prev) => {
      networkTracker.toggleNetwork(prev);
      return !prev;
    });
  };

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
      unfilteredNetworkLogs: networkTracker.networkLogs,
      networkLogs,
      isRecording,
      toggleRecording,
      filters,
      setFilters,
      isScrolling,
      clearActivity,
      toggleScrolling,
      isSearchVisible,
      toggleSearchVisible,
      isTimelineVisible,
      toggleTimelineVisible,
    };
  }, [isRecording, filters, isSearchVisible, isScrolling, isTimelineVisible, networkLogs]);

  return <NetworkContext.Provider value={contextValue}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }

  return context;
}
