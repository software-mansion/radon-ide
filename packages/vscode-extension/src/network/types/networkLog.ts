import { NetworkRequestInitiator, RequestData, ResponseBodyDataType, ResponseData, TimelineEvent } from "./network";
import { NetworkEvent } from "./panelMessageProtocol";

export interface NetworkLog {
  currentState: NetworkEvent;
  requestId: string;
  request?: RequestData;
  response?: ResponseData;
  encodedDataLength?: number;
  type?: ResponseBodyDataType;
  timeline: TimelineEvent;
  initiator?: NetworkRequestInitiator;
}

export enum NetworkLogColumn {
  Name = "name",
  Status = "status",
  Method = "method",
  Type = "type",
  Size = "size",
  Time = "time",
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
