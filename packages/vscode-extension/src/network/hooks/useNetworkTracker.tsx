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
  NetworkType,
  IDEMethod,
  SessionData,
} from "../types/panelMessageProtocol";
import { generateId, createIDEResponsePromise } from "../utils/panelMessages";

export interface NetworkTracker {
  networkLogs: NetworkLog[];
  isTracking: boolean;
  clearLogs: () => void;
  getSource: (networkLog: NetworkLog) => void;
  sendWebviewCDPMessage: (messageData: CDPMessage) => void;
  sendWebviewIDEMessage: (messageData: IDEMessage) => void;
  setIsTracking: React.Dispatch<React.SetStateAction<boolean>>;
}

export const networkTrackerInitialState: NetworkTracker = {
  networkLogs: [],
  isTracking: true,
  clearLogs: () => {},
  getSource: () => {},
  sendWebviewCDPMessage: () => {},
  sendWebviewIDEMessage: () => {},
  setIsTracking: () => {},
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
  const [isTracking, setIsTracking] = useState(true);

  const isSynchronisedRef = useRef(false);

  const requestTimingTrackerRef = useRef(new RequestTimingTracker());
  const requestTimingTracker = requestTimingTrackerRef.current;

  const validateCDPMessage = (message: WebviewMessage): CDPMessage | null => {
    try {
      const { payload, command } = message;

      // Only accept CDP messages
      if (command !== WebviewCommand.CDPCall) {
        return null;
      }

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

  const getSessionData = (): Promise<SessionData> => {
    const messageId = generateId();
    const promise = createIDEResponsePromise<SessionData>(messageId, IDEMethod.SessionData);

    sendWebviewIDEMessage({
      method: IDEMethod.GetSessionData,
      messageId: messageId,
    });

    return promise;
  };

  const updateCDPMessages = (message: WebviewMessage) => {
    const cdpMessage = validateCDPMessage(message);
    if (cdpMessage) {
      setCdpMessages((prev) => [...prev, cdpMessage]);
    }
  };

  const synchronizeSessionData = async () => {
    const sessionData = await getSessionData();
    const { networkMessages, shouldTrackNetwork } = sessionData || {};

    networkMessages.forEach(updateCDPMessages);

    setIsTracking(shouldTrackNetwork);
    isSynchronisedRef.current = true;
  };

  const handleWindowMessage = (message: MessageEvent) => {
    const webviewMessage: WebviewMessage = message.data;

    if (webviewMessage.payload.method === IDEMethod.ClearStoredMessages) {
      setNetworkLogs([]);
      setCdpMessages([]);
      return;
    }

    updateCDPMessages(webviewMessage);
  };

  useEffect(() => {
    if (!isSynchronisedRef.current) {
      return;
    }
    sendNetworkTrackingUpdate(isTracking);
  }, [isTracking]);

  useEffect(() => {
    synchronizeSessionData();
    window.addEventListener("message", handleWindowMessage);

    return () => {
      window.removeEventListener("message", handleWindowMessage);
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

    sendWebviewIDEMessage({
      messageId: "clearStoredMessages",
      method: IDEMethod.ClearStoredMessages,
    });
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

  const sendNetworkTrackingUpdate = (shouldTrack: boolean) => {
    sendWebviewIDEMessage({
      messageId: "toggleTracking",
      method: shouldTrack ? IDEMethod.StartNetworkTracking : IDEMethod.StopNetworkTracking,
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
    isTracking,
    clearLogs,
    getSource,
    sendWebviewCDPMessage,
    sendWebviewIDEMessage,
    setIsTracking,
  };
};

export default useNetworkTracker;
