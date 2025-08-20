import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
  useState,
} from "react";
import useNetworkTracker, {
  NetworkTracker,
  networkTrackerInitialState,
} from "../hooks/useNetworkTracker";
import { useNetworkFilter, NetworkFilterProvider } from "./NetworkFilterProvider";

interface NetworkProviderProps extends NetworkTracker {
  isRecording: boolean;
  isScrolling: boolean;
  toggleRecording: () => void;
  clearActivity: () => void;
  toggleScrolling: () => void;
  isTimelineVisible: boolean;
  toggleTimelineVisible: () => void;
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
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  return (
    <NetworkFilterProvider>
      <NetworkProviderInner>{children}</NetworkProviderInner>
    </NetworkFilterProvider>
  );
}

function NetworkProviderInner({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();
  const { getFilterMatches } = useNetworkFilter();

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

  const networkLogs = useMemo(() => {
    return networkTracker.networkLogs.filter(getFilterMatches);
  }, [networkTracker.networkLogs, getFilterMatches]);

  const contextValue = useMemo(() => {
    return {
      ...networkTracker,
      networkLogs,
      isRecording,
      toggleRecording,
      isScrolling,
      clearActivity,
      toggleScrolling,
      isTimelineVisible,
      toggleTimelineVisible,
    };
  }, [isRecording, isScrolling, isTimelineVisible, networkLogs, networkTracker]);

  return <NetworkContext.Provider value={contextValue}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }

  return context;
}
