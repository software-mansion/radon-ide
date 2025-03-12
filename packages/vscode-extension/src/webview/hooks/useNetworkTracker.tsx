import { useEffect, useState } from "react";
import { useNetwork } from "../providers/NetworkProvider";

enum RequestType {
  XHR = "xhr",
  Image = "image",
  Script = "script",
  CSS = "css",
  Font = "font",
  Media = "media",
}

enum RequestMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
  HEAD = "HEAD",
  OPTIONS = "OPTIONS",
}

enum NetworkMethods {
  RequestWillBeSent = "Network.requestWillBeSent",
  ResponseReceived = "Network.responseReceived",
  LoadingFinished = "Network.loadingFinished",
}

interface NetworkRequest {
  requestId: string;
  loaderId: string;
  timestamp: number;
  wallTime: number;
  request: {
    url: string;
    method: RequestMethod;
    headers: Record<string, string>;
  };
  type: RequestType;
  initiator: {
    type: string;
  };
}

interface NetworkResponse {
  requestId: string;
  loaderId: string;
  timestamp: number;
  type: RequestType;
  response: {
    url: string;
    status: number;
    headers: Record<string, string>;
    mimeType: string;
  };
}

interface NetworkLoadingFinished {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}

interface WebSocketMessage {
  method: NetworkMethods;
  params: NetworkRequest | NetworkResponse | NetworkLoadingFinished;
}

interface NetworkLog {
  requestId: string;
  url: string;
  status: number;
  method: RequestMethod;
  type: RequestType;
  startTimestamp: number;
  endTimestamp: number;
  duration: number;
  headers: Record<string, string>;
}

const useNetworkTracker = (): NetworkLog[] => {
  const { isClearing, isRecording, clearActivity } = useNetwork();
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  useEffect(() => {
    if (isClearing) {
      setNetworkLogs([]);
      clearActivity();
    }
  }, [isClearing]);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.__websocketEndpoint}`);

    ws.onmessage = (message) => {
      try {
        if (!isRecording) {
          return;
        }
        const parsedMessage: WebSocketMessage = JSON.parse(message.data);
        const { method, params } = parsedMessage;
        if (!params.requestId) {
          return;
        }

        setNetworkLogs((prevLogs) => {
          const newLogs = [...prevLogs];

          const existingLogIndex = newLogs.findIndex((log) => log.requestId === params.requestId);
          if (existingLogIndex !== -1) {
            const existingLog = newLogs[existingLogIndex];
            if (method === NetworkMethods.RequestWillBeSent) {
              newLogs[existingLogIndex] = {
                ...existingLog,
                url: (params as NetworkRequest).request.url,
                method: (params as NetworkRequest).request.method,
                type: (params as NetworkRequest).type,
                startTimestamp: (params as NetworkRequest).timestamp,
                headers: (params as NetworkRequest).request.headers,
              };
            } else if (method === NetworkMethods.ResponseReceived) {
              newLogs[existingLogIndex] = {
                ...existingLog,
                status: (params as NetworkResponse).response.status,
                endTimestamp: (params as NetworkResponse).timestamp,
                headers: (params as NetworkResponse).response.headers,
              };
            } else if (method === NetworkMethods.LoadingFinished) {
              newLogs[existingLogIndex] = {
                ...existingLog,
                endTimestamp: (params as NetworkLoadingFinished).timestamp,
              };
            }
          } else {
            if (method === NetworkMethods.RequestWillBeSent) {
              newLogs.push({
                requestId: params.requestId,
                url: (params as NetworkRequest).request.url,
                status: 0,
                method: (params as NetworkRequest).request.method,
                type: (params as NetworkRequest).type,
                startTimestamp: (params as NetworkRequest).timestamp,
                endTimestamp: 0,
                duration: 0,
                headers: (params as NetworkRequest).request.headers,
              });
            }
          }

          return newLogs;
        });
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    return () => {
      ws.close();
    };
  }, [isRecording]);

  return networkLogs;
};

export default useNetworkTracker;
