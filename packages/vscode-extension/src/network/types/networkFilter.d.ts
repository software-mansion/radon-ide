import { NetworkLogColumn } from "./networkLog";

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
