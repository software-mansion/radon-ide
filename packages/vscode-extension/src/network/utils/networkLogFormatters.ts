import { NetworkLog } from "../hooks/useNetworkTracker";
import { FilterBadge } from "../providers/NetworkFilterProvider";
import { NetworkLogColumn, SortDirection } from "../types/network";

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
export function parseTextToBadge(text: string) {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      newBadge: null,
      remainingText: text,
    };
  }

  // Extract filters from the beginning of the text
  // Support both quoted and unquoted values: method:value or method:"quoted value"
  // No spaces allowed before or immediately after the colon
  // Empty quotes are not considered valid
  // Unquoted values cannot start with a quote character
  let newBadge: FilterBadge | null = null;
  let remainingText = trimmedText;

  let fullMatch = "";
  let columnName = "";
  let filterValue = "";

  // Try to match quoted value first: column:"value"
  const quotedMatch = remainingText.match(/^(\w+):"([^"]*)"/);
  if (quotedMatch) {
    fullMatch = quotedMatch[0];
    columnName = quotedMatch[1];
    filterValue = quotedMatch[2];
  } else {
    // Try to match unquoted value: column:value (until space)
    const unquotedMatch = remainingText.match(/^(\w+):([^\s:"][^\s]*?|)(?=\s|$)/);
    if (unquotedMatch) {
      fullMatch = unquotedMatch[0];
      columnName = unquotedMatch[1];
      filterValue = unquotedMatch[2];
    }
  }

  if (fullMatch && columnName) {
    const columnNames = ["name", "status", "method", "type", "size", "time"];

    if (columnNames.includes(columnName.toLowerCase())) {
      const normalizedColumnName = columnName.toLowerCase();
      const normalizedValue = filterValue;

      newBadge = {
        id: `${normalizedColumnName}-${normalizedValue}-${Date.now()}-${Math.random()}`,
        columnName: normalizedColumnName,
        value: normalizedValue,
      };

      remainingText = remainingText.substring(fullMatch.length).trim();
    }
  }

  return { newBadge, remainingText };
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
