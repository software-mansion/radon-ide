import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import useNetworkTracker, {
  NetworkTracker,
  networkTrackerInitialState,
} from "../hooks/useNetworkTracker";
import { NetworkFilterProvider } from "./NetworkFilterProvider";
import { NetworkLog } from "../types/networkLog";
import { NetworkPanelMessage } from "../types/panelMessageProtocol";
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
  const { clearLogs, toggleNetwork, sendIDEMessage, sendCDPMessage, ws, networkLogs } =
    networkTracker;

  const [isTimelineVisible, toggleTimelineVisible] = useReducer((state) => !state, true);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);
  const [isRecording, setIsRecording] = useState(true);
  const responseBodiesRef = useRef<Record<string, ResponseBodyData | undefined>>({});

  const clearActivity = () => {
    clearLogs();
    responseBodiesRef.current = {};
  };

  const toggleRecording = () => {
    setIsRecording((prev) => {
      toggleNetwork(prev);
      return !prev;
    });
  };

  const getResponseBody = (networkLog: NetworkLog): Promise<ResponseBodyData | undefined> => {
    const requestId = networkLog.requestId;

    if (!requestId || !ws) {
      return Promise.resolve(undefined);
    }

    if (responseBodiesRef.current[requestId]) {
      return Promise.resolve(responseBodiesRef.current[requestId]);
    }

    const id = Math.random().toString(36).substring(7);

    // Send the message to the network-plugin backend
    sendCDPMessage({
      id,
      method: "Network.getResponseBody",
      params: {
        requestId: requestId,
      },
    });

    // Add a listener to capture the response
    return new Promise((resolve) => {
      const listener = (message: MessageEvent<string>) => {
        try {
          const parsedMsg: NetworkPanelMessage = JSON.parse(message.data);
          if (parsedMsg.type !== "CDP" || parsedMsg.payload.id !== id) {
            return;
          }
          const bodyData: ResponseBodyData | undefined = parsedMsg.payload.result as
            | ResponseBodyData
            | undefined;

          if (bodyData === undefined) {
            ws.removeEventListener("message", listener);
            resolve(responseBodiesRef.current[requestId]);
            return;
          }

          responseBodiesRef.current[requestId] = bodyData;

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
    const request = networkLog.request;

    if (!requestId || !ws || !request) {
      return Promise.resolve(undefined);
    }

    const id = Math.random().toString(36).substring(7);

    sendIDEMessage({
      id,
      method: "IDE.fetchFullResponseBody",
      params: {
        request: request,
      },
    });
  };

  const contextValue = useMemo(() => {
    return {
      ...networkTracker,
      networkLogs: networkLogs,
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
