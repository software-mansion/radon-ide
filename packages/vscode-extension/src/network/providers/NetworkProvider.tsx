import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
  useState,
} from "react";
import useNetworkTracker, {
  NetworkLog,
  NetworkTracker,
  networkTrackerInitialState,
} from "../hooks/useNetworkTracker";
import { NetworkFilterProvider } from "./NetworkFilterProvider";

interface NetworkProviderProps extends NetworkTracker {
  isRecording: boolean;
  isScrolling: boolean;
  toggleRecording: () => void;
  clearActivity: () => void;
  toggleScrolling: () => void;
  isTimelineVisible: boolean;
  toggleTimelineVisible: () => void;
  getResponseBody: (networkLog: NetworkLog) => Promise<unknown>;
}

const NetworkContext = createContext<NetworkProviderProps>({
  ...networkTrackerInitialState,
  isRecording: true,
  isScrolling: false,
  toggleRecording: () => {},
  clearActivity: () => {},
  toggleScrolling: () => {},
  isTimelineVisible: true,
  toggleTimelineVisible: () => {},
  getResponseBody: async () => undefined,
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();

  const [isTimelineVisible, toggleTimelineVisible] = useReducer((state) => !state, true);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);
  const [isRecording, setIsRecording] = useState(true);
  const [responseBodies, setResponseBodies] = useState<Record<string, unknown>>({});

  const clearActivity = () => {
    networkTracker.clearLogs();
    setResponseBodies({});
  };

  const toggleRecording = () => {
    setIsRecording((prev) => {
      networkTracker.toggleNetwork(prev);
      return !prev;
    });
  };

  const getResponseBody = (networkLog: NetworkLog) => {
    const ws = networkTracker.ws;
    if (responseBodies[networkLog.requestId]) {
      return Promise.resolve(responseBodies[networkLog.requestId]);
    }

    const id = Math.random().toString(36).substring(7);

    ws?.send(
      JSON.stringify({
        id,
        method: "Network.getResponseBody",
        params: {
          requestId: networkLog.requestId,
        },
      })
    );

    return new Promise((resolve) => {
      const listener = (message: MessageEvent) => {
        try {
          const parsedMsg = JSON.parse(message.data);
          if (parsedMsg.id === id) {
            setResponseBodies((prev) => ({
              ...prev,
              [networkLog.requestId]: parsedMsg.result.body,
            }));
            resolve(parsedMsg.result.body);
            ws?.removeEventListener("message", listener);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws?.addEventListener("message", listener);
    });
  };

  const contextValue = useMemo(() => {
    return {
      ...networkTracker,
      networkLogs: networkTracker.networkLogs,
      isRecording,
      toggleRecording,
      isScrolling,
      clearActivity,
      toggleScrolling,
      isTimelineVisible,
      toggleTimelineVisible,
      getResponseBody,
    };
  }, [isRecording, isScrolling, isTimelineVisible, networkTracker.networkLogs]);

  return (
    <NetworkContext.Provider value={contextValue}>
      <NetworkFilterProvider>{children}</NetworkFilterProvider>
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }

  return context;
}
