import { useEffect, useMemo, useState } from "react";
import { vscode } from "../../webview/utilities/vscode";
import { CDPNetworkCommand, WebviewCommand } from "../../webview/utilities/communicationTypes";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

export interface NetworkRequest {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  postData?: string;
}

export interface NetworkRequestInitiator {
  sourceUrl: string;
  lineNumber: number;
  columnNumber: number;
}

export interface NetworkResponse {
  type: string;
  status: number;
  statusText: string;
  headers?: Record<string, string>;
  content?: unknown;
  mimeType?: string;
}

export interface TimelineEvent {
  timestamp: number;
  wallTime: number;
  durationMs?: number;
  ttfb?: number;
}

type NetworkState =
  | "Network.requestWillBeSent"
  | "Network.responseReceived"
  | "Network.loadingFinished"
  | "Network.loadingFailed";

export interface NetworkLog {
  currentState: NetworkState;
  requestId: string;
  request?: NetworkRequest;
  response?: NetworkResponse;
  encodedDataLength?: number;
  type?: string;
  timeline: TimelineEvent;
  initiator?: NetworkRequestInitiator;
}

export interface WebSocketMessage {
  method: NetworkState;
  params?: {
    encodedDataLength?: number;
    requestId: string;
    request?: NetworkRequest;
    response?: NetworkResponse;
    timestamp: number;
    ttfb?: number;
    wallTime: number;
    type?: string;
    initiator?: NetworkRequestInitiator;
    duration?: number;
  };
}

export interface NetworkTracker {
  networkLogs: NetworkLog[];
  clearLogs: () => void;
  toggleNetwork: (isRunning: boolean) => void;
  getSource: (networkLog: NetworkLog) => void;
}

export const networkTrackerInitialState: NetworkTracker = {
  networkLogs: [],
  clearLogs: () => {},
  toggleNetwork: () => {},
  getSource: () => {},
};

const useNetworkTracker = (): NetworkTracker => {
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [serverMessages, setServerMessages] = useState<string[]>([]);

  const processServerMessage = (msg: string, newLogs: NetworkLog[]): void => {
    try {
      const parsedMsg: WebSocketMessage = JSON.parse(msg);

      const { method, params } = parsedMsg;

      if (!params?.requestId) {
        return;
      }

      const existingIndex = newLogs.findIndex((log) => log.requestId === params.requestId);

      if (existingIndex !== -1) {
        const existingLog = newLogs[existingIndex];

        newLogs[existingIndex] = {
          ...existingLog,
          currentState: method,
          request: params.request || existingLog.request,
          response: params.response || existingLog.response,
          initiator: params.initiator || existingLog.initiator,
          timeline: {
            ...existingLog.timeline,
            timestamp: params.timestamp,
            wallTime: params.wallTime,
            durationMs: params.duration || existingLog.timeline.durationMs,
            ttfb: params.ttfb || existingLog.timeline.ttfb,
          },
          type: params.type || existingLog.type,
          encodedDataLength: params.encodedDataLength || existingLog.encodedDataLength,
        };
      } else {
        newLogs.push({
          currentState: method,
          requestId: params.requestId,
          request: params.request,
          response: params.response,
          encodedDataLength: params.encodedDataLength,
          type: params.type,
          initiator: params.initiator,
          timeline: {
            timestamp: params.timestamp,
            wallTime: params.wallTime,
            durationMs: params.duration,
            ttfb: params.ttfb,
          },
        });
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };

  useEffect(() => {
    window.onmessage = (message) => {
      setServerMessages((prev) => [...prev, message.data]);
    };
  }, []);

  useEffect(() => {
    if (serverMessages.length === 0) {
      return;
    }
    setNetworkLogs((prevLogs) => {
      const newLogs = [...prevLogs];
      // FIXME: Do we really need to map the entirety of this array on every single addition
      serverMessages.map((msg) => processServerMessage(msg, newLogs));
      return newLogs;
    });
  }, [serverMessages]);

  const clearLogs = () => {
    setNetworkLogs([]);
    setServerMessages([]);
  };

  const toggleNetwork = (isRunning: boolean) => {
    vscode.postMessage({
      command: WebviewCommand.CDPCall,
      method: isRunning ? CDPNetworkCommand.Disable : CDPNetworkCommand.Enable,
    });
  };

  const getSource = (networkLog: NetworkLog) => {
    vscode.postMessage({
      command: WebviewCommand.CDPCall,
      method: CDPNetworkCommand.Initiator,
      params: {
        ...networkLog.initiator,
      },
    });
  };

  const validLogs = useMemo(
    () => networkLogs.filter((log) => log?.request?.url !== undefined),
    [networkLogs.length]
  );

  return {
    networkLogs: validLogs,
    clearLogs,
    toggleNetwork,
    getSource,
  };
};

export default useNetworkTracker;
