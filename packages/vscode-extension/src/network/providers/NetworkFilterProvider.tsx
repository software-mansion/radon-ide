import {
  createContext,
  PropsWithChildren,
  useContext,
  useRef,
  useState,
  RefObject,
  useMemo,
  useEffect,
} from "react";
import {
  getNetworkLogValue,
  NETWORK_LOG_COLUMNS,
  parseTextToBadge,
} from "../utils/networkLogUtils";
import { NetworkLog } from "../hooks/useNetworkTracker";
import { useNetwork } from "./NetworkProvider";

export interface FilterBadge {
  id: string;
  columnName: string;
  value: string;
}

// lookup structure for badge filters
type BadgeFilterLookup = Record<string, string[]>;

interface NetworkFilterContextValue {
  // Filter state
  filterText: string;
  filterBadges: FilterBadge[];
  filterInvert: boolean;
  filterInputRef: RefObject<HTMLInputElement | null>;
  isFilterVisible: boolean;
  wasColumnFilterAddedToInputField: boolean;
  filteredNetworkLogs: NetworkLog[];

  // Filter management functions
  setFilterText: (value: string | ((prev: string) => string)) => void;
  addColumnFilterToInputField: (column: string) => void;
  toggleInvert: () => void;
  clearAllFilters: () => void;
  setFilterBadges: (badges: FilterBadge[]) => void;
  toggleFilterVisible: () => void;
}

const NetworkFilterContext = createContext<NetworkFilterContextValue | null>(null);

export function NetworkFilterProvider({ children }: PropsWithChildren) {
  const [filterText, setFilterText] = useState<string>("");
  const [filterBadges, setFilterBadges] = useState<FilterBadge[]>([]);
  const [filterInvert, setInvert] = useState<boolean>(false);
  const [wasColumnFilterAddedToInputField, setWasColumnFilterAddedToInputField] =
    useState<boolean>(false);
  const [isFilterVisible, setIsFilterVisible] = useState<boolean>(false);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const { networkLogs } = useNetwork();

  useEffect(() => {
    if (wasColumnFilterAddedToInputField) {
      setWasColumnFilterAddedToInputField(false);
    }
  }, [wasColumnFilterAddedToInputField]);

  useEffect(() => {
    if (!isFilterVisible) {
      clearAllFilters();
    }
  }, [isFilterVisible]);

  const badgeFiltersPresent = filterBadges.length > 0;

  const badgeFiltersByColumnLookup: BadgeFilterLookup = useMemo(() => {
    const columnValueSets: Record<string, string[]> = {};

    filterBadges.forEach(({ columnName, value }) => {
      if (!columnValueSets[columnName]) {
        columnValueSets[columnName] = [];
      }
      columnValueSets[columnName].push(value.toLowerCase());
    });

    return columnValueSets;
  }, [filterBadges]);

  const addColumnFilterToInputField = (column: string) => {
    setWasColumnFilterAddedToInputField(true);
    setIsFilterVisible(true);
    setFilterText((prev) => {
      // Check if any column filter pattern (COLUMN:"") exists and replace it
      const filterPattern = /(\w+):""/;
      const match = prev.match(filterPattern);

      if (match) {
        return prev.replace(filterPattern, `${column}:""`);
      }

      // If no existing filter pattern, add the new one at the beginning
      return `${column}:"" ${prev}`;
    });
  };

  const computeBadgeFilterMatches = (badge: FilterBadge | null, log: NetworkLog): boolean => {
    if (!badgeFiltersPresent && !badge) {
      return true;
    }
    // AND between columns, OR within column values
    return NETWORK_LOG_COLUMNS.every((columnName) => {
      const columnValue = getNetworkLogValue(log, columnName).toLowerCase();

      if (!badgeFiltersByColumnLookup[columnName] && !(badge?.columnName === columnName)) {
        return true;
      }

      if (badge && badge.columnName === columnName) {
        if (columnValue.includes(badge.value)) {
          return true;
        }
      }

      return badgeFiltersByColumnLookup[columnName]?.some((value) => {
        if (columnValue.includes(value)) {
          return true;
        }
      });
    });
  };

  const computeTextMatches = (filterTextValue: string, log: NetworkLog) => {
    // Check global search term (if any remaining text after parsing filters)
    const globalMatches =
      !filterTextValue.trim() ||
      NETWORK_LOG_COLUMNS.some((column) =>
        getNetworkLogValue(log, column).toLowerCase().includes(filterTextValue.toLowerCase())
      );

    return globalMatches;
  };

  const getFilterMatches = (log: NetworkLog): boolean => {
    const { badge, remainingText } = parseTextToBadge(filterText);

    const badgeMatches = computeBadgeFilterMatches(badge, log);

    // Check text filter (global search or remaining text after parsing)
    const textMatches = !filterText.trim() || computeTextMatches(remainingText, log);

    const finalMatch = badgeMatches && textMatches;

    return finalMatch !== filterInvert;
  };

  const toggleInvert = () => {
    setInvert((prev) => !prev);
  };

  const clearAllFilters = () => {
    setFilterText("");
    setFilterBadges([]);
    setInvert(false);
  };

  const toggleFilterVisible = () => {
    setIsFilterVisible((prev) => !prev);
  };

  const filteredNetworkLogs = useMemo(() => {
    return networkLogs.filter(getFilterMatches);
  }, [networkLogs, filterText, filterBadges, filterInvert]);

  const contextValue: NetworkFilterContextValue = {
    // Filter state
    filterText,
    filterBadges,
    filterInputRef,
    filterInvert,
    isFilterVisible,
    wasColumnFilterAddedToInputField,
    filteredNetworkLogs,

    // Filter management functions
    setFilterText,
    addColumnFilterToInputField,
    toggleInvert,
    clearAllFilters,
    setFilterBadges,
    toggleFilterVisible,
  };

  return (
    <NetworkFilterContext.Provider value={contextValue}>{children}</NetworkFilterContext.Provider>
  );
}

export function useNetworkFilter() {
  const context = useContext(NetworkFilterContext);

  if (!context) {
    throw new Error("useNetworkFilter must be used within a NetworkFilterProvider");
  }

  return context;
}
