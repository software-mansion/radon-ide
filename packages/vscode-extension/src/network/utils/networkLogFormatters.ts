import { NetworkLog } from "../hooks/useNetworkTracker";
import { NetworkLogColumn, SortDirection, ParsedFilter } from "../types/network";

const NetworkLogFormatters = {
  Name: (log: NetworkLog): string => {
    return log.request?.url.split("/").pop() || "(pending)";
  },

  Status: (log: NetworkLog): string => {
    return String(log.response?.status || "(pending)");
  },

  Method: (log: NetworkLog): string => {
    return log.request?.method || "(pending)";
  },

  Type: (log: NetworkLog): string => {
    return log.type || "(pending)";
  },

  Size: (log: NetworkLog): string => {
    const size = log.encodedDataLength;
    if (!size) {
      return "(pending)";
    }
    const units = ["B", "KB", "MB", "GB", "TB"];
    let unitIndex = 0;
    let formattedSize = size;
    while (formattedSize >= 1024 && unitIndex < units.length - 1) {
      formattedSize /= 1024;
      unitIndex++;
    }
    return `${parseFloat(formattedSize.toFixed(2) || "")} ${units[unitIndex]}`;
  },

  Time: (log: NetworkLog): string => {
    return log.timeline?.durationMs ? `${log.timeline?.durationMs} ms` : "(pending)";
  },
} as const;

/**
 * Helper function to get the formatted value for a specific column from a NetworkLog
 */
export function getNetworkLogValue(log: NetworkLog, column: NetworkLogColumn): string {
  return NetworkLogFormatters[column](log);
}

/**
 * Parse filter text in format "column:value column2:value2" or plain text for global search
 */
export function parseFilterText(filterText: string): {
  parsedFilters: ParsedFilter[];
  globalSearchTerm: string;
} {
  const parsedFilters: ParsedFilter[] = [];
  let remainingText = filterText.trim();

  // Column name mapping for case-insensitive matching
  const columnMapping: Record<string, NetworkLogColumn> = {
    name: NetworkLogColumn.Name,
    status: NetworkLogColumn.Status,
    method: NetworkLogColumn.Method,
    type: NetworkLogColumn.Type,
    size: NetworkLogColumn.Size,
    time: NetworkLogColumn.Time,
  };

  // Regex to match "column:value" patterns, handling values with spaces
  // This matches column names followed by : and captures everything until the next column: pattern or end of string
  const filterRegex = /(\w+):\s*([^]*?)(?=\s+\w+:|$)/g;
  let match;
  let matchedPositions: Array<{ start: number; end: number }> = [];

  while ((match = filterRegex.exec(filterText)) !== null) {
    const [fullMatch, columnName, value] = match;
    const normalizedColumn = columnMapping[columnName.toLowerCase()];

    if (normalizedColumn) {
      parsedFilters.push({
        columnName: normalizedColumn,
        value: value.trim(),
      });

      // Track matched positions to remove from remaining text
      matchedPositions.push({
        start: match.index,
        end: match.index + fullMatch.length,
      });
    }
  }

  // Remove matched filters from remaining text
  if (matchedPositions.length > 0) {
    // Sort by position descending to remove from end to start
    matchedPositions.sort((a, b) => b.start - a.start);

    for (const pos of matchedPositions) {
      remainingText = filterText.substring(0, pos.start) + filterText.substring(pos.end);
      filterText = remainingText; // Update for next iteration
    }
  }

  return {
    parsedFilters,
    globalSearchTerm: remainingText.trim(),
  };
}

/**
 * Get autocomplete suggestion for partial filter text
 */
export function getFilterAutocompleteSuggestion(filterText: string): string {
  // No suggestion if empty or ends with whitespace
  if (!filterText || filterText !== filterText.trimEnd()) {
    return "";
  }
  const trimmed = filterText.trim();
  // No suggestion if contains internal whitespace (spaces mean it's not a partial column name)
  if (/\s/.test(trimmed)) {
    return "";
  }

  // Check if the input starts to match any column name
  const columnNames = ["name", "status", "method", "type", "size", "time"];
  const matchingColumn = columnNames.find((col) => col.startsWith(trimmed.toLowerCase()));

  // Only suggest if there's a match and it's not already complete
  if (matchingColumn && matchingColumn !== trimmed.toLowerCase()) {
    return matchingColumn.substring(trimmed.length) + ":";
  }

  return "";
}

export function sortNetworkLogs(
  networkLogs: NetworkLog[],
  column: NetworkLogColumn | null,
  direction: SortDirection | null
): NetworkLog[] {
  if (!column || !direction) {
    return networkLogs;
  }

  const compare = (a: NetworkLog, b: NetworkLog) => {
    const aValue = getNetworkLogValue(a, column);
    const bValue = getNetworkLogValue(b, column);
    let comparison = 0;

    // Handle numeric sorting for Status, Size, and Time columns
    switch (column) {
      case NetworkLogColumn.Status: {
        const aNum = parseInt(aValue) || 0;
        const bNum = parseInt(bValue) || 0;
        comparison = aNum - bNum;
        break;
      }
      case NetworkLogColumn.Size: {
        /** Extract numeric value from size string ("1.5 KB" -> 1536) */
        const getSizeInBytes = (sizeStr: string): number => {
          if (sizeStr === "(pending)") {
            return 0;
          }

          /**
           * Extracts numeric value and unit.
           * The pattern captures a number (with optional decimal places) followed by optional whitespace and a unit string.
           *
           * @example
           * // Matches strings like "1.5 MB", "250KB", "10 bytes"
           * // Returns: ["1.5 MB", "1.5", "MB"] or null if no match
           */
          const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(\w+)$/);
          if (!match) {
            return 0;
          }

          const value = parseFloat(match[1]);
          const unit = match[2];
          const multipliers: Record<string, number> = {
            B: 1,
            KB: 1024,
            MB: Math.pow(1024, 2),
            GB: Math.pow(1024, 3),
            TB: Math.pow(1024, 4),
          };
          return value * (multipliers[unit] || 0);
        };

        comparison = getSizeInBytes(aValue) - getSizeInBytes(bValue);
        break;
      }
      case NetworkLogColumn.Time: {
        // Extract numeric value from time string ("150 ms" -> 150)
        const aNum = parseInt(aValue) || 0;
        const bNum = parseInt(bValue) || 0;
        comparison = aNum - bNum;
        break;
      }
      default: {
        // String comparison for other columns
        comparison = aValue.localeCompare(bValue);
        break;
      }
    }

    return direction === SortDirection.Asc ? comparison : -comparison;
  };

  return [...networkLogs].sort(compare);
}

/**
 * Array of all available network log columns for use in filters, tables
 */
export const NETWORK_LOG_COLUMNS: NetworkLogColumn[] = [
  NetworkLogColumn.Name,
  NetworkLogColumn.Status,
  NetworkLogColumn.Method,
  NetworkLogColumn.Type,
  NetworkLogColumn.Size,
  NetworkLogColumn.Time,
];
