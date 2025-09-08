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
  fetchResponseBody: (networkLog: NetworkLog) => Promise<void>;
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
  fetchResponseBody: async () => {},
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();

  const [isTimelineVisible, toggleTimelineVisible] = useReducer((state) => !state, true);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);
  const [isRecording, setIsRecording] = useState(true);

  const clearActivity = () => {
    networkTracker.clearLogs();
  };

  const toggleRecording = () => {
    setIsRecording((prev) => {
      networkTracker.toggleNetwork(prev);
      return !prev;
    });
  };

  const fetchResponseBody = async (networkLog: NetworkLog) => {
    const requestId = networkLog.requestId;
    const ws = networkTracker.ws;

    if (!requestId || !ws) {
      return Promise.resolve(undefined);
    }

    const id = Math.random().toString(36).substring(7);
    
    ws.send(
      JSON.stringify({
        id,
        method: "Network.fetchFullRequestBody",
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
      fetchResponseBody
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
