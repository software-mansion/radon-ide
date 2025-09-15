import { useEffect, useState } from "react";
import { vscode } from "../../webview/utilities/vscode";
import { NetworkLog } from "../types/networkLog";
import {
  CDPMessage,
  IDEMessage,
  WebviewMessage,
  NetworkEvent,
  NETWORK_EVENTS,
  WebviewCommand,
} from "../types/panelMessageProtocol";

export interface NetworkTracker {
  networkLogs: NetworkLog[];
  clearLogs: () => void;
  toggleNetwork: (isRunning: boolean) => void;
  getSource: (networkLog: NetworkLog) => void;
  sendWebviewCDPMessage: (messageData: CDPMessage) => void;
  sendWebviewIDEMessage: (messageData: IDEMessage) => void;
}

export const networkTrackerInitialState: NetworkTracker = {
  networkLogs: [],
  clearLogs: () => {},
  toggleNetwork: () => {},
  getSource: () => {},
  sendWebviewCDPMessage: () => {},
  sendWebviewIDEMessage: () => {},
};

const useNetworkTracker = (): NetworkTracker => {
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [cdpMessages, setCdpMessages] = useState<CDPMessage[]>([]);

  const validateCDPMessage = (message: WebviewMessage): CDPMessage | null => {
    try {
      const { payload, command } = message;

      // Only accept CDP messages
      if (command !== WebviewCommand.CDPCall) {
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

    // Already checked in validateCDPMessage, but TS needs more convincing
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
        type: params.type || existingLog.type,
        encodedDataLength: params.encodedDataLength || existingLog.encodedDataLength,
      };
    } else {
      newLogs.push({
        currentState: networkEventMethod,
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
  };

  useEffect(() => {
    const listener = (message: MessageEvent) => {
      const cdpMessage = validateCDPMessage(message.data);
      if (cdpMessage) {
        setCdpMessages((prev) => [...prev, cdpMessage]);
      }
    };

    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
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

  const sendWebviewCDPMessage = (messageData: CDPMessage) => {
    vscode.postMessage({
      command: WebviewCommand.CDPCall,
      payload: messageData,
    });
  };

  const sendWebviewIDEMessage = (messageData: IDEMessage) => {
    vscode.postMessage({
      command: WebviewCommand.IDECall,
      payload: messageData,
    });
  };

  const toggleNetwork = (isRunning: boolean) => {
    sendWebviewCDPMessage({
      id: "enable",
      method: isRunning ? "Network.disable" : "Network.enable",
    });
  };

  const getSource = (networkLog: NetworkLog) => {
    sendWebviewCDPMessage({
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
    clearLogs,
    toggleNetwork,
    getSource,
    sendWebviewCDPMessage,
    sendWebviewIDEMessage,
  };
};

export default useNetworkTracker;
