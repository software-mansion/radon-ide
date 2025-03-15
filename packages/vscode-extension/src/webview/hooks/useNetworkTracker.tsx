import { useEffect, useRef, useState } from "react";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

export interface NetworkRequest {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  postData?: unknown;
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

export interface NetworkTracker {
  networkLogs: NetworkLog[];
  ws: WebSocket | null;
  getResponseBody: (networkLog: NetworkLog) => Promise<unknown>;
  clearLogs: () => void;
  toggleNetwork: (isRunning: boolean) => void;
}

export const networkTrackerInitialState: NetworkTracker = {
  networkLogs: [],
  ws: null,
  getResponseBody: async () => undefined,
  clearLogs: () => {},
  toggleNetwork: () => {},
};

const useNetworkTracker = (): NetworkTracker => {
  const wsRef = useRef<WebSocket | null>(null);

  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [serverMessages, setServerMessages] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.__websocketEndpoint}`);
    wsRef.current = ws;

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

  const clearLogs = () => {
    setNetworkLogs([]);
    setServerMessages([]);
  };

  const toggleNetwork = (isRunning: boolean) => {
    wsRef.current?.send(
      JSON.stringify({
        method: isRunning ? "Network.disable" : "Network.enable",
      })
    );
  };

  const getResponseBody = (networkLog: NetworkLog) => {
    const id = Math.random().toString(36).substring(7);

    wsRef.current?.send(
      JSON.stringify({
        id,
        method: "Network.getResponseBody",
        params: {
          requestId: networkLog.requestId,
          response: networkLog.response,
        },
      })
    );

    return new Promise((resolve) => {
      const listener = (message: MessageEvent) => {
        console.log("Message received: asd ", message.data);
        try {
          const parsedMsg = JSON.parse(message.data);
          if (parsedMsg.id === id) {
            resolve(parsedMsg.result.body);
            wsRef.current?.removeEventListener("message", listener);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      wsRef.current?.addEventListener("message", listener);
    });
  };

  return {
    networkLogs: networkLogs.filter((log) => log?.request?.url !== undefined),
    ws: wsRef.current,
    getResponseBody,
    clearLogs,
    toggleNetwork,
  };
};

export default useNetworkTracker;
