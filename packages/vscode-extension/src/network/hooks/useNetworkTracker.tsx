import { useEffect, useRef, useState } from "react";
import { NetworkLog } from "../types/networkLog";
import {
  CDPMessage,
  IDEMessage,
  NetworkPanelMessage,
  NetworkEvent,
  NETWORK_EVENTS,
} from "../types/panelMessageProtocol";

export interface NetworkTracker {
  networkLogs: NetworkLog[];
  ws: WebSocket | null;
  clearLogs: () => void;
  toggleNetwork: (isRunning: boolean) => void;
  getSource: (networkLog: NetworkLog) => void;
  sendCDPMessage: (messageData: CDPMessage) => void;
  sendIDEMessage: (messageData: IDEMessage) => void;
}

export const networkTrackerInitialState: NetworkTracker = {
  networkLogs: [],
  ws: null,
  clearLogs: () => {},
  toggleNetwork: () => {},
  getSource: () => {},
  sendCDPMessage: () => {},
  sendIDEMessage: () => {},
};

const useNetworkTracker = (): NetworkTracker => {
  const wsRef = useRef<WebSocket | null>(null);

  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [cdpMessages, setCdpMessages] = useState<CDPMessage[]>([]);

  const validateCDPMessage = (message: string): CDPMessage | null => {
    try {
      const parsedMsg: NetworkPanelMessage = JSON.parse(message);
      const { payload, type } = parsedMsg;

      // Only accept CDP messages
      if (type !== "CDP") {
        return null;
      }

      const haveRequiredFields = payload.params?.timestamp && payload.params?.requestId;
      const isNetworkEvent = NETWORK_EVENTS.includes(payload.method as NetworkEvent);

      if (!isNetworkEvent || !haveRequiredFields) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
      return null;
    }
  };

  const processServerMessage = (cdpMessage: CDPMessage, newLogs: NetworkLog[]): void => {
    const { method, params } = cdpMessage;

    if (!params?.requestId || !params?.timestamp) {
      return;
    }

    const networkEventMethod = method as NetworkEvent;
    const existingIndex = newLogs.findIndex((log) => log.requestId === params.requestId);

    if (existingIndex !== -1) {
      const existingLog = newLogs[existingIndex];

      newLogs[existingIndex] = {
        ...existingLog,
        currentState: networkEventMethod,
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
        type: params?.type || existingLog?.type,
        encodedDataLength: params.encodedDataLength || existingLog.encodedDataLength,
      };
    } else {
      newLogs.push({
        currentState: networkEventMethod,
        requestId: params.requestId,
        request: params.request,
        response: params.response,
        encodedDataLength: params.encodedDataLength,
        type: params?.type,
        initiator: params.initiator,
        timeline: {
          timestamp: params.timestamp,
          wallTime: params.wallTime,
          durationMs: params.duration,
          ttfb: params.ttfb,
        },
      });
    }
  };

  useEffect(() => {
    const websocketEndpoint = document.querySelector<HTMLMetaElement>(
      "meta[name='websocketEndpoint']"
    )?.content;

    const ws = new WebSocket(`ws://${websocketEndpoint}`);
    wsRef.current = ws;

    ws.onmessage = (message) => {
      const cdpMessage = validateCDPMessage(message.data);
      if (cdpMessage) {
        setCdpMessages((prev) => [...prev, cdpMessage]);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (cdpMessages.length === 0) {
      return;
    }
    setNetworkLogs((prevLogs) => {
      const newLogs = [...prevLogs];
      cdpMessages.forEach((cdpMessage) => processServerMessage(cdpMessage, newLogs));
      return newLogs;
    });
  }, [cdpMessages]);

  const clearLogs = () => {
    setNetworkLogs([]);
    setCdpMessages([]);
  };

  const sendCDPMessage = (messageData: CDPMessage) => {
    wsRef.current?.send(
      JSON.stringify({
        type: "CDP",
        payload: messageData,
      })
    );
  };

  const sendIDEMessage = (messageData: IDEMessage) => {
    wsRef.current?.send(
      JSON.stringify({
        type: "IDE",
        payload: messageData,
      })
    );
  };

  const toggleNetwork = (isRunning: boolean) => {
    sendCDPMessage({ id: "enable", method: isRunning ? "Network.disable" : "Network.enable" });
  };

  const getSource = (networkLog: NetworkLog) => {
    sendCDPMessage({
      id: "initiator",
      method: "Network.Initiator",
      params: {
        requestId: networkLog.requestId,
        initiator: networkLog.initiator,
      },
    });
  };

  return {
    networkLogs: networkLogs.filter((log) => log?.request?.url !== undefined),
    ws: wsRef.current,
    clearLogs,
    toggleNetwork,
    getSource,
    sendCDPMessage,
    sendIDEMessage,
  };
};

export default useNetworkTracker;
