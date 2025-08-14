import { createContext, PropsWithChildren, useContext, useMemo, useReducer, useState } from "react";
import useNetworkTracker, {
  NetworkTracker,
  networkTrackerInitialState,
} from "../hooks/useNetworkTracker";
import { getNetworkLogValue, NETWORK_LOG_COLUMNS, parseFilterText } from "../utils/networkLogFormatters";

type TimestampRange = {
  start: number;
  end: number;
};

interface Filters {
  timestampRange?: TimestampRange;
  filterText: string;
  invert: boolean;
}

const DEFAULT_FILTER: Filters = {
  timestampRange: undefined,
  filterText: "",
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
      const { timestampRange, filterText, invert } = filters;

      // Timestamp range filter
      const matchesTimestampRange =
        !timestampRange ||
        (log.timeline.timestamp >= timestampRange.start &&
          log.timeline.timestamp <= timestampRange.end);

      const matchesFilter = (() => {
        // If no filter text, show all logs
        if (!filterText.trim()) {
          return true;
        }

        const { parsedFilters, globalSearchTerm } = parseFilterText(filterText);
        
        // Check specific column filters
        const columnMatches = parsedFilters.every(({ columnName, value }) => {
          const columnValue = getNetworkLogValue(log, columnName);
          return columnValue.toLowerCase().includes(value.toLowerCase());
        });
        
        // Check global search term (if any remaining text after parsing filters)
        const globalMatches = !globalSearchTerm.trim() || NETWORK_LOG_COLUMNS.some((column) =>
          getNetworkLogValue(log, column).toLowerCase().includes(globalSearchTerm.toLowerCase())
        );

        const finalMatch = columnMatches && globalMatches;
        return finalMatch !== invert; // XOR invert logic
      })();

      return matchesFilter && matchesTimestampRange;
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
