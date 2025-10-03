import { NetworkLog } from "../types/networkLog";
import { NetworkLogColumn, NETWORK_LOG_COLUMNS } from "../types/networkLog";
import { FilterBadge } from "../types/networkFilter";
import { NetworkEvent } from "../types/panelMessageProtocol";

interface ParsedText {
  badge: FilterBadge | null;
  remainingText: string;
}

/**
 * Higher-order function that handles common state checking logic for network log formatters.
 * Returns appropriate messages based on the loading state and value presence.
 */
function getLogValueWithChecks<T>(
  log: NetworkLog,
  extractLogValue: (log: NetworkLog) => T | undefined | null,
  unknownMessage: string = "(unknown)",
  failedMessage: string = "(failed)",
  pendingMessage: string = "(pending)"
): string {
  const isFinished = log.currentState === NetworkEvent.LoadingFinished;
  const isFailed = log.currentState === NetworkEvent.LoadingFailed;
  const value = extractLogValue(log);

  if (isFinished && !value) {
    return unknownMessage;
  }

  if (isFailed && !value) {
    return failedMessage;
  }

  return String(value || pendingMessage);
}

/**
 * Define value formatting for specific columns, as they differ in representation
 */
const NetworkLogFormatters = {
  name: (log: NetworkLog): string => {
    try {
      const parsedUrl = new URL(log.request?.url || "");
      const hostname = parsedUrl.hostname.startsWith("www.")
        ? parsedUrl.hostname.slice(4)
        : parsedUrl.hostname;
      // remove trailing slashes
      const parsedPathName = parsedUrl.pathname.replace(/\/+$/, "");
      const maybeLastPathSegment = parsedPathName?.split("/").pop();

      return maybeLastPathSegment || hostname;
    } catch (error) {
      return "(unknown)";
    }
  },

  status: (log: NetworkLog): string => {
    const exctractLogStatus = () => log.response?.status;
    return getLogValueWithChecks(log, exctractLogStatus);
  },

  method: (log: NetworkLog): string => {
    const exctractLogMethod = () => log.request?.method;
    return getLogValueWithChecks(log, exctractLogMethod);
  },

  type: (log: NetworkLog): string => {
    const exctractLogType = () => log.type;
    return getLogValueWithChecks(log, exctractLogType);
  },

  size: (log: NetworkLog): string => {
    const exctractLogSize = () => {
      const size = log.encodedDataLength;
      const status = log.response?.status;
      if (size === undefined || status === 204) {
        return undefined;
      }

      const units = ["B", "KB", "MB", "GB", "TB"];
      let unitIndex = 0;
      let formattedSize = size;
      while (formattedSize >= 1024 && unitIndex < units.length - 1) {
        formattedSize /= 1024;
        unitIndex++;
      }
      return `${parseFloat(formattedSize.toFixed(2) || "")} ${units[unitIndex]}`;
    };

    return getLogValueWithChecks(
      log,
      exctractLogSize,
      "0 B", // unknownMessage
      "0 B" // failedMessage
    );
  },

  time: (log: NetworkLog): string => {
    const exctractLogTime = () => log.timeline?.durationMs && `${log.timeline?.durationMs} ms`;
    return getLogValueWithChecks(log, exctractLogTime);
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
