import { ThemeDescriptor } from "../../common/theme";
import { RequestData, ResponseData, NetworkRequestInitiator } from "./network";

export enum NetworkEvent {
  RequestWillBeSent = "Network.requestWillBeSent",
  RequestWillBeSentExtraInfo = "Network.requestWillBeSentExtraInfo",
  ResponseReceived = "Network.responseReceived",
  LoadingFinished = "Network.loadingFinished",
  LoadingFailed = "Network.loadingFailed",
  DataReceived = "Network.dataReceived",
}

export enum NetworkType {
  Initiator = "Network.Initiator",
}

export enum NetworkMethod {
  Enable = "Network.enable",
  Disable = "Network.disable",
  GetResponseBody = "Network.getResponseBody",
  StoreResponseBody = "Network.storeResponseBody",
}

export const NETWORK_EVENTS = Object.values(NetworkEvent);

export const NETWORK_METHODS = Object.values(NetworkMethod);

export const NETWORK_TYPES = Object.values(NetworkType);

export type CDPMethod = NetworkEvent | NetworkMethod | NetworkType;

export enum IDEMethod {
  FetchFullResponseBody = "IDE.fetchFullResponseBody",
  GetTheme = "IDE.getTheme",
  Theme = "IDE.Theme",
  GetLogHistory = "IDE.getLogHistory",
}

export function isCDPMethod(method: string): method is CDPMethod {
  return (
    NETWORK_EVENTS.includes(method as NetworkEvent) ||
    NETWORK_METHODS.includes(method as NetworkMethod) ||
    NETWORK_TYPES.includes(method as NetworkType)
  );
}

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
  messageId?: string | number;
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
  messageId?: string | number;
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
