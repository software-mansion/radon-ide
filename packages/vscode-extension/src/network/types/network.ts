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
  Name = "Name",
  Status = "Status",
  Method = "Method",
  Type = "Type",
  Size = "Size",
  Time = "Time",
}

export type FilterType = "All" | NetworkLogColumn;

export interface ParsedFilter {
  columnName: NetworkLogColumn;
  value: string;
}

export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}
