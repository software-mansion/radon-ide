import _ from "lodash";
import { useEffect, useRef, useState } from "react";
import { vscode } from "../../webview/utilities/vscode";
import { NetworkLog } from "../types/networkLog";
import {
  CDPMessage,
  IDEMessage,
  WebviewMessage,
  NetworkEvent,
  NETWORK_EVENTS,
  WebviewCommand,
  NetworkMethod,
  NetworkType,
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

interface NetworkEventTimestampMap {
  [NetworkEvent.RequestWillBeSent]?: number;
  [NetworkEvent.ResponseReceived]?: number;
  [NetworkEvent.LoadingFinished]?: number;
  [NetworkEvent.LoadingFailed]?: number;
}

interface RequestDurationData {
  totalTime?: number;
  ttfb?: number;
  downloadTime?: number;
}

/**
 * Necessitated by the new network inspector architecture, which does not provide
 * durationMs and ttfb fields directly in the events. Instead, the class calculates the time
 * differences based on the timestamps of the relevant events:
 * - totalTime = loadingFinished.timestamp - requestWillBeSent.timestamp;
 * - ttfb = responseReceived.timestamp - requestWillBeSent.timestamp;
 * - downloadTime = loadingFinished.timestamp - responseReceived.timestamp;
 */
class RequestTimingTracker {
  private requestTimestampMap: Map<string | number, NetworkEventTimestampMap> = new Map();

  private calculateTimeDifference(
    timeStart: number | undefined,
    timeEnd: number | undefined
  ): number | undefined {
    if (timeStart === undefined || timeEnd === undefined) {
      return undefined;
    }
    return _.round((timeEnd - timeStart) * 1000, 2);
  }

  public setRequestTimestamp(message: CDPMessage) {
    const { method, params } = message;
    const { requestId, timestamp } = params || {};
    if (!requestId || !timestamp) {
      return;
    }

    const existingTimestamps = this.requestTimestampMap.get(requestId) || {};
    this.requestTimestampMap.set(requestId, {
      ...existingTimestamps,
      [method]: timestamp,
    });
  }

  public getRequestDurationData(message: CDPMessage): RequestDurationData {
    const { requestId } = message.params || {};
    if (!requestId) {
      return {};
    }
    const timestamps = this.requestTimestampMap.get(requestId);
    if (!timestamps) {
      return {};
    }

    const requestWillBeSentTimestamp = timestamps[NetworkEvent.RequestWillBeSent];
    const responseReceivedTimestamp = timestamps[NetworkEvent.ResponseReceived];
    const loadingFinishedTimestamp =
      timestamps[NetworkEvent.LoadingFinished] ?? timestamps[NetworkEvent.LoadingFailed];

    const timingData: RequestDurationData = {};

    timingData.ttfb = this.calculateTimeDifference(
      requestWillBeSentTimestamp,
      responseReceivedTimestamp
    );

    timingData.totalTime = this.calculateTimeDifference(
      requestWillBeSentTimestamp,
      loadingFinishedTimestamp
    );

    timingData.downloadTime = this.calculateTimeDifference(
      responseReceivedTimestamp,
      loadingFinishedTimestamp
    );

    return timingData;
  }
}

const useNetworkTracker = (): NetworkTracker => {
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [cdpMessages, setCdpMessages] = useState<CDPMessage[]>([]);
  const requestTimtingTrakcerRef = useRef(new RequestTimingTracker());
  const requestTimingTracker = requestTimtingTrakcerRef.current;

  const validateCDPMessage = (message: WebviewMessage): CDPMessage | null => {
    try {
      const { payload, command } = message;

      // Only accept CDP messages
      if (command !== WebviewCommand.CDPCall) {
        return null;
      }

      // Timestamp check was removed because Network.requestExtraInfo does not have information about it
      const haveRequiredFields = !!payload.params?.requestId;
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
    if (!params?.requestId) {
      return;
    }

    requestTimingTracker.setRequestTimestamp(cdpMessage);
    const requestDurationData = requestTimingTracker.getRequestDurationData(cdpMessage);

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
          durationMs:
            params.duration ?? requestDurationData.totalTime ?? existingLog.timeline.durationMs,
          ttfb: params.ttfb ?? requestDurationData.ttfb ?? existingLog.timeline.ttfb,
          downloadTime: requestDurationData.downloadTime ?? existingLog.timeline.downloadTime,
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
      messageId: "enable",
      method: isRunning ? NetworkMethod.Disable : NetworkMethod.Enable,
    });
  };

  const getSource = (networkLog: NetworkLog) => {
    sendWebviewCDPMessage({
      messageId: "initiator",
      method: NetworkType.Initiator,
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
