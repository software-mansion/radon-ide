import { useEffect, useState } from "react";

interface NetworkLog {
  currentState?: string;
  requestId?: string;
  request?: any;
  response?: any;
  timeline?: {
    timestamp?: number;
    wallTime?: number;
  };
}

interface WebSocketMessage {
  method?: string;
  params?: {
    requestId?: string;
    request?: any;
    response?: any;
    timestamp?: number;
    wallTime?: number;
  };
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
            newLogs[existingIndex] = {
              ...newLogs[existingIndex],
              currentState: method,
              request: params.request || newLogs[existingIndex].request,
              response: params.response || newLogs[existingIndex].response,
              timeline: {
                timestamp: params.timestamp,
                wallTime: params.wallTime,
              },
            };
          } else {
            newLogs.push({
              currentState: method,
              requestId: params.requestId,
              request: params.request,
              response: params.response,
              timeline: {
                timestamp: params.timestamp,
                wallTime: params.wallTime,
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

  return networkLogs;
};

export default useNetworkTracker;
