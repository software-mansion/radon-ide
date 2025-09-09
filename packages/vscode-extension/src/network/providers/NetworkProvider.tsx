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
import { ResponseBodyData } from "../types/network";

interface NetworkProviderProps extends NetworkTracker {
  isRecording: boolean;
  isScrolling: boolean;
  toggleRecording: () => void;
  clearActivity: () => void;
  toggleScrolling: () => void;
  isTimelineVisible: boolean;
  toggleTimelineVisible: () => void;
  fetchAndOpenResponseInEditor: (networkLog: NetworkLog) => Promise<void>;
  getResponseBody: (networkLog: NetworkLog) => Promise<ResponseBodyData | undefined>;
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
  fetchAndOpenResponseInEditor: async () => {},
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();

  const [isTimelineVisible, toggleTimelineVisible] = useReducer((state) => !state, true);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);
  const [isRecording, setIsRecording] = useState(true);
  const [responseBodies, setResponseBodies] = useState<Record<string, ResponseBodyData>>({});

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

  const getResponseBody = (networkLog: NetworkLog): Promise<ResponseBodyData | undefined> => {
    const requestId = networkLog.requestId;
    const ws = networkTracker.ws;

    if (!requestId || !ws) {
      return Promise.resolve(undefined);
    }

    if (responseBodies[requestId]) {
      return Promise.resolve(responseBodies[requestId]);
    }

    const id = Math.random().toString(36).substring(7);

    // Send the message to the network-plugin backend
    ws.send(
      JSON.stringify({
        id,
        method: "Network.getResponseBody",
        params: {
          requestId: requestId,
        },
      })
    );

    // Add a listener to capture the response
    return new Promise((resolve) => {
      const listener = (message: MessageEvent) => {
        try {
          const parsedMsg = JSON.parse(message.data);
          if (parsedMsg.id !== id) {
            return;
          }

          const bodyData = parsedMsg.result;
          setResponseBodies((prev) => ({
            ...prev,
            [requestId]: bodyData,
          }));

          resolve(bodyData);

          ws.removeEventListener("message", listener);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.addEventListener("message", listener);
    });
  };

  const fetchAndOpenResponseInEditor = async (networkLog: NetworkLog) => {
    const requestId = networkLog.requestId;
    const ws = networkTracker.ws;

    if (!requestId || !ws) {
      return Promise.resolve(undefined);
    }

    const id = Math.random().toString(36).substring(7);

    ws.send(
      JSON.stringify({
        id,
        method: "Network.fetchFullResponseBody",
        params: {
          request: networkLog.request,
        },
      })
    );
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
      fetchAndOpenResponseInEditor,
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
