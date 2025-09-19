import { ThemeDescriptor } from "../../utilities/themeExtraction";
import { RequestData, ResponseData, NetworkRequestInitiator } from "./network";

export type NetworkEvent =
  | "Network.requestWillBeSent"
  | "Network.responseReceived"
  | "Network.loadingFinished"
  | "Network.loadingFailed";

export type NetworkType = "Network.Initiator";

export type NetworkControlCommand =
  | "Network.enable"
  | "Network.disable"
  | "Network.getResponseBody";

export const NETWORK_EVENTS = [
  "Network.requestWillBeSent",
  "Network.responseReceived",
  "Network.loadingFinished",
  "Network.loadingFailed",
] as const;

export const NETWORK_CONTROL_COMMANDS = [
  "Network.enable",
  "Network.disable",
  "Network.getResponseBody",
] as const;

export type CDPMethod = NetworkEvent | NetworkControlCommand | NetworkType;

export type IDEMethod = "IDE.fetchFullResponseBody" | "IDE.getTheme" | "IDE.Theme";

export interface CDPParams {
  // Common fields
  requestId?: string;
  timestamp?: number;
  wallTime?: number;

  // Request-related
  request?: RequestData;

  // Response-related
  response?: ResponseData;
  type?: string;

  // Timing / performance
  encodedDataLength?: number;
  duration?: number;
  ttfb?: number;

  // Source tracking
  initiator?: NetworkRequestInitiator;

  // Errors
  errorText?: string;
  canceled?: boolean;

  // additional fields
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
type IDEMessageParams = {
  request?: RequestData;
  themeDescriptor?: ThemeDescriptor;
};

// IDE-specific message structure
export interface IDEMessage {
  method: IDEMethod;
  id?: string | number;
  params?: IDEMessageParams;
  result?: unknown;
}

export enum WebviewCommand {
  CDPCall = "cdp-call",
  IDECall = "ide-call",
}

// Union type for all webview messages
export type WebviewMessage =
  | { command: WebviewCommand.CDPCall; payload: CDPMessage }
  | { command: WebviewCommand.IDECall; payload: IDEMessage };
