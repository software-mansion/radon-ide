import {
  CopySubmenuConfig,
  FilterItemConfig,
  SortSubmenuConfig,
} from "../components/ContextMenu/ContextMenuItems";

export interface NetworkLog {
  requestId: string;
  url: string;
  status: number;
  method: string;
  type: string;
  startTimestamp: number;
  endTimestamp: number;
  duration: number;
  headers: Record<string, string>;
}

export enum NetworkLogColumn {
  Name = "name",
  Status = "status",
  Method = "method",
  Type = "type",
  Size = "size",
  Time = "time",
}

export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

export interface FilterBadge {
  id: string;
  columnName: string;
  value: string;
}

export interface SortState {
  column: NetworkLogColumn | null;
  direction: SortDirection | null;
}

export enum ContextMenuItemName {
  Copy = "copy",
  Sort = "sort",
  Filter = "filter",
}

export interface ContextMenuItems {
  [ContextMenuItemName.Copy]?: CopySubmenuConfig;
  [ContextMenuItemName.Sort]?: SortSubmenuConfig;
  [ContextMenuItemName.Filter]?: FilterItemConfig;
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
] as const;
