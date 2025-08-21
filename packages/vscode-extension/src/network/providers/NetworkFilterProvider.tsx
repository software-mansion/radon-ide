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
import { FilterBadge } from "../types/network";



// lookup structure for badge filters
type BadgeByColumnsLookup = Record<string, string[]>;

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

  /**
   * Below useEffect is meant to work like an event emitter - it triggers a change in state column filter is added.
   * wasColumnFilterAddedToInputField after set true is immediately set false afterwards, which results
   * in instant state change which can be "observed" in other components, without unnecesary coupling between them.
   */
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

  const badgeByColumnLookup: BadgeByColumnsLookup = useMemo(() => {
    const columnValueSets: Record<string, string[]> = {};

    filterBadges.forEach(({ columnName, value }) => {
      if (!columnValueSets[columnName]) {
        columnValueSets[columnName] = [];
      }
      columnValueSets[columnName].push(value.toLowerCase());
    });

    return columnValueSets;
  }, [filterBadges]);

  /**
   * Computes whether a network log matches the current badge filters and input text badge.
   *
   * The filtering logic uses AND between columns and OR within column values:
   * - All columns must match their respective filters (AND logic)
   * - Within a column, any filter value can match (OR logic)
   *
   * If no badge filters are present and no input text badge is provided, returns true (no filtering).
   *
   * @param inputTextBadge - The badge being written in the text input, which is not added to filterBadges yet
   * @param log - The network log entry to check against filters
   * @returns True if the log matches all active filters, false otherwise
   */
  const computeBadgeFilterMatches = (
    inputTextBadge: FilterBadge | null,
    log: NetworkLog
  ): boolean => {
    // no filtering if neither badge filters nor inputTextBadge are present
    if (!badgeFiltersPresent && !inputTextBadge) {
      return true;
    }

    // AND between columns, OR within column values
    return NETWORK_LOG_COLUMNS.every((columnName) => {
      const columnValue = getNetworkLogValue(log, columnName).toLowerCase();

      // if there are no column filters of the type, leave early
      if (!badgeByColumnLookup[columnName] && !(inputTextBadge?.columnName === columnName)) {
        return true;
      }

      // try matching inputTextBadge (OR logic)
      if (inputTextBadge && inputTextBadge.columnName === columnName) {
        if (columnValue.includes(inputTextBadge.value)) {
          return true;
        }
      }

      // match filterBadges within column (OR logic)
      return badgeByColumnLookup[columnName]?.some((value) => {
        if (columnValue.includes(value)) {
          return true;
        }
      });
    });
  };

  /**
   * Computes text matches for a network log entry against a filter text value,
   * which is not a badge (global filtering value).
   *
   * @param filterTextValue - The text value to search for within the network log
   * @param log - The network log entry to search within
   * @returns True if the filter text matches any column value in the network log, or if the filter text is empty/whitespace
   */
  const computeTextMatches = (filterTextValue: string, log: NetworkLog) => {
    // Check global search term (if any remaining text after parsing badge filters)
    const globalMatches =
      !filterTextValue.trim() ||
      NETWORK_LOG_COLUMNS.some((column) =>
        getNetworkLogValue(log, column).toLowerCase().includes(filterTextValue.toLowerCase())
      );

    return globalMatches;
  };

  /**
   * Determines if a network log entry matches the current filter criteria.
   * Evaluates both badge-based and global-text-based matching criteria
   *
   * @param log - The network log entry to evaluate against the filter
   * @returns True if the log matches the filter criteria (considering inversion), false otherwise
   */
  const getFilterMatches = (log: NetworkLog): boolean => {
    const { badge, remainingText } = parseTextToBadge(filterText);

    const badgeMatches = computeBadgeFilterMatches(badge, log);

    // Check text filter (global search or remaining text after parsing)
    const textMatches = !filterText.trim() || computeTextMatches(remainingText, log);

    const finalMatch = badgeMatches && textMatches;

    // apply the invert by XOR
    return finalMatch !== filterInvert;
  };

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
