import { NetworkLogColumn, NetworkLog } from "../types/networkLog";
import { SortDirection } from "../types/networkFilter";
import { getNetworkLogValue } from "./networkLogParsers";

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
        const aSize = a.encodedDataLength ?? 0;
        const bSize = b.encodedDataLength ?? 0;
        comparison = aSize - bSize;
        break;
      }
      case NetworkLogColumn.Time: {
        const aTime = a.timeline?.durationMs ?? 0;
        const bTime = b.timeline?.durationMs ?? 0;
        comparison = aTime - bTime;
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

  return networkLogs.toSorted(compare);
}
