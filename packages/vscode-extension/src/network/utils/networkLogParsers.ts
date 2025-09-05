import { NetworkLog } from "../hooks/useNetworkTracker";
import { FilterBadge } from "../types/network";
import { NetworkLogColumn } from "../types/network";
import { NETWORK_LOG_COLUMNS } from "../types/network";

interface ParsedText {
  badge: FilterBadge | null;
  remainingText: string;
}

/**
 * Define value formatting for specific columns, as they differ in representation
 */
const NetworkLogFormatters = {
  name: (log: NetworkLog): string => {
    return log.request?.url.split("/").pop() || "(pending)";
  },

  status: (log: NetworkLog): string => {
    return String(log.response?.status || "(pending)");
  },

  method: (log: NetworkLog): string => {
    return log.request?.method || "(pending)";
  },

  type: (log: NetworkLog): string => {
    return log.type || "(pending)";
  },

  size: (log: NetworkLog): string => {
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

  time: (log: NetworkLog): string => {
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
 * Parses text input to extract a filter badge from the beginning of the string.
 *
 * Supports two filter formats:
 * - Quoted values: `column:"value"` (allows spaces inside)
 * - Unquoted values: `column:value` (no spaces, cannot start with quote)
 *
 * @param text - The input text to parse for filter badges
 * @returns An object containing:
 *   - `badge`: A FilterBadge object if a valid filter is found, null otherwise
 *   - `remainingText`: The input text with the parsed badge trimmed
 */
export function parseTextToBadge(text: string): ParsedText {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      badge: null,
      remainingText: text,
    };
  }

  // Extract filters from the beginning of the text
  // Support both quoted and unquoted values: method:value or method:"quoted value"
  // No spaces allowed before or immediately after the colon
  // Empty quotes are not considered valid
  // Unquoted values cannot start with a quote character
  let badge: FilterBadge | null = null;
  let remainingText = trimmedText;

  let fullMatch = "";
  let columnName = "";
  let filterValue = "";

  // Try to match quoted value first: column:"value" (including empty value)
  const quotedMatch = remainingText.match(/^(\w+):"([^"]*)"/);
  if (quotedMatch) {
    fullMatch = quotedMatch[0];
    columnName = quotedMatch[1];
    filterValue = quotedMatch[2];
  } else {
    // Try to match unquoted value: column:value (including empty value)
    const unquotedMatch = remainingText.match(/^(\w+):([^\s:"][^\s]*?|)(?=\s|$)/);
    if (unquotedMatch) {
      fullMatch = unquotedMatch[0];
      columnName = unquotedMatch[1];
      filterValue = unquotedMatch[2];
    }
  }

  if (fullMatch && columnName) {
    const columnNames = NETWORK_LOG_COLUMNS as string[];

    const normalizedColumnName = columnName.toLowerCase();
    if (columnNames.includes(normalizedColumnName)) {
      badge = {
        id: `${normalizedColumnName}-${filterValue}`,
        columnName: normalizedColumnName,
        value: filterValue,
      };

      remainingText = remainingText.substring(fullMatch.length).trim();
    }
  }

  return { badge, remainingText };
}
