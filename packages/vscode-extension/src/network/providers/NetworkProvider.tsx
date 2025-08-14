import { createContext, PropsWithChildren, useContext, useMemo, useReducer, useState } from "react";
import useNetworkTracker, {
  NetworkTracker,
  networkTrackerInitialState,
} from "../hooks/useNetworkTracker";
import { getNetworkLogValue, NETWORK_LOG_COLUMNS } from "../utils/networkLogFormatters";
import { FilterType } from "../types/network";

type TimestampRange = {
  start: number;
  end: number;
};

interface Filters {
  timestampRange?: TimestampRange;
  filterType: FilterType;
  filterValue?: string;
  invert: boolean;
}

const DEFAULT_FILTER: Filters = {
  timestampRange: undefined,
  filterType: "All",
  filterValue: "",
  invert: false,
} as const;

interface NetworkProviderProps extends NetworkTracker {
  unfilteredNetworkLogs: NetworkTracker["networkLogs"];
  isRecording: boolean;
  filters: Filters;
  isScrolling: boolean;
  toggleRecording: () => void;
  setFilters: (filters: Filters) => void;
  clearActivity: () => void;
  toggleScrolling: () => void;
  isFilterVisible: boolean;
  toggleFilterVisible: () => void;
  isTimelineVisible: boolean;
  toggleTimelineVisible: () => void;
}

const NetworkContext = createContext<NetworkProviderProps>({
  ...networkTrackerInitialState,
  unfilteredNetworkLogs: [],
  isRecording: true,
  isFilterVisible: false,
  filters: DEFAULT_FILTER,
  isScrolling: false,
  toggleRecording: () => {},
  toggleFilterVisible: () => {},
  setFilters: () => {},
  clearActivity: () => {},
  toggleScrolling: () => {},
  isTimelineVisible: true,
  toggleTimelineVisible: () => {},
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();

  const [isTimelineVisible, toggleTimelineVisible] = useReducer((state) => !state, true);
  const [isFilterVisible, toggleFilterVisible] = useReducer((state) => !state, false);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);

  const [isRecording, setIsRecording] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTER);

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
      const { timestampRange, filterType, filterValue, invert } = filters;
      console.log("mleko", invert)

      // Timestamp range filter
      const matchesTimestampRange =
        !timestampRange ||
        (log.timeline.timestamp >= timestampRange.start &&
          log.timeline.timestamp <= timestampRange.end);

      const matchesNewFilter = (() => {
        // If no filter, show all logs
        if (!filterValue) {
          return true;
        }

        // If "All", search in all columns
        if (filterType === "All") {
          const matches = NETWORK_LOG_COLUMNS.some((column) =>
            getNetworkLogValue(log, column).toLowerCase().includes(filterValue.toLowerCase())
          );
          return matches !== invert; // XOR invert logic
        }

        // Otherwise, search specific column
        const matches = getNetworkLogValue(log, filterType)
          .toLowerCase()
          .includes(filterValue.toLowerCase());
        return matches !== invert; // XOR invert logic
      })();

      return matchesNewFilter && matchesTimestampRange;
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
      isFilterVisible,
      toggleFilterVisible,
      isTimelineVisible,
      toggleTimelineVisible,
    };
  }, [isRecording, filters, isFilterVisible, isScrolling, isTimelineVisible, networkLogs]);

  return <NetworkContext.Provider value={contextValue}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }

  return context;
}
