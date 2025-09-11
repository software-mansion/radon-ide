import { RequestData, ResponseData, NetworkRequestInitiator } from "./network";

export type NetworkEvent =
  | "Network.requestWillBeSent"
  | "Network.responseReceived"
  | "Network.loadingFinished"
  | "Network.loadingFailed"
  | "Network.Initiator";

export type NetworkControlCommand =
  | "Network.enable"
  | "Network.disable"
  | "Network.getResponseBody";

export type CDPMethod = NetworkEvent | NetworkControlCommand;

export type IDEMethod = "IDE.fetchFullResponseBody";

export interface CDPParams {
  // Common fields
  requestId?: string;
  timestamp?: number;
  wallTime?: number;

  // Request-related fields
  request?: RequestData;

  // Response-related fields
  response?: ResponseData;
  type?: string;

  // Timing and performance fields
  encodedDataLength?: number;
  duration?: number;
  ttfb?: number;

  // Source tracking fields
  initiator?: NetworkRequestInitiator;

  // Error fields
  errorText?: string;
  canceled?: boolean;

  // Allow additional fields for extensibility
  [key: string]: unknown;
}

// Generic CDP message structure
export interface CDPMessage {
  method: CDPMethod;
  id?: string | number;
  params?: CDPParams;
  result?: unknown;
}

// IDE message parameters
interface IDEMessageParams {
  request?: RequestData;
}

// IDE-specific message structure
export interface IDEMessage {
  method: IDEMethod;
  id?: string | number;
  params?: IDEMessageParams;
  result?: unknown;
}

// Union type for all network panel messages
export type NetworkPanelMessage =
  | { type: "CDP"; payload: CDPMessage }
  | { type: "IDE"; payload: IDEMessage };
