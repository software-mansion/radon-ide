import { NetworkLog } from "../hooks/useNetworkTracker";
import { NetworkLogColumn, FilterType } from "../types/network";

export const NetworkLogFormatters = {
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
export const getNetworkLogValue = (log: NetworkLog, column: NetworkLogColumn): string => {
  return NetworkLogFormatters[column](log);
};

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

/**
 * Array of all filter types
 */
export const FILTER_TYPES: FilterType[] = ["All", ...NETWORK_LOG_COLUMNS];
