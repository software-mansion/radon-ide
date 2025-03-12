import { useEffect, useState } from "react";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

export interface NetworkRequest {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  postData?: unknown;
}

export interface NetworkResponse {
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
}

export interface WebSocketMessage {
  method: NetworkState;
  params: {
    encodedDataLength?: number;
    requestId: string;
    request?: NetworkRequest;
    response?: NetworkResponse;
    timestamp: number;
    wallTime: number;
    type?: string;
  };
}

declare global {
  interface Window {
    __websocketEndpoint: string;
  }
}

const useNetworkTracker = (): NetworkLog[] => {
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [serverMessages, setServerMessages] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.__websocketEndpoint}`);

    ws.onmessage = (message) => {
      setServerMessages((prev) => [...prev, message.data]);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (serverMessages.length === 0) {
      return;
    }

    setNetworkLogs((prevLogs) => {
      const newLogs = [...prevLogs];

      serverMessages.forEach((msg) => {
        try {
          const parsedMsg: WebSocketMessage = JSON.parse(msg);
          const { method, params } = parsedMsg;

          if (!params?.requestId) {
            return;
          }

          const existingIndex = newLogs.findIndex((log) => log.requestId === params.requestId);

          if (existingIndex !== -1) {
            const existingLog = newLogs[existingIndex];
            const startTime = existingLog.timeline.timestamp;
            const endTime = params.timestamp;
            const durationMs =
              startTime && endTime ? Math.round((endTime - startTime) * 1000) : undefined;

            newLogs[existingIndex] = {
              ...existingLog,
              currentState: method,
              request: params.request || existingLog.request,
              response: params.response || existingLog.response,
              timeline: {
                timestamp: params.timestamp,
                wallTime: params.wallTime,
                durationMs: durationMs || existingLog.timeline.durationMs,
              },
              type: params?.type || existingLog?.type,
              encodedDataLength: params.encodedDataLength || existingLog.encodedDataLength,
            };
          } else {
            newLogs.push({
              currentState: method,
              requestId: params.requestId,
              request: params.request,
              response: params.response,
              encodedDataLength: params.encodedDataLength,
              type: params?.type,
              timeline: {
                timestamp: params.timestamp,
                wallTime: params.wallTime,
                durationMs: undefined,
              },
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      return newLogs;
    });
  }, [serverMessages]);

  return networkLogs.filter((log) => log?.request?.url !== undefined);
};

export default useNetworkTracker;
