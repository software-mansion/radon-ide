import { createContext, PropsWithChildren, useContext, useMemo, useReducer, useState } from "react";
import useNetworkTracker, {
  NetworkLog,
  NetworkTracker,
  networkTrackerInitialState,
} from "../hooks/useNetworkTracker";
import { NetworkFilterProvider } from "./NetworkFilterProvider";
import { vscode } from "../../webview/utilities/vscode";

interface NetworkProviderProps extends NetworkTracker {
  isScrolling: boolean;
  toggleScrolling: () => void;
  isTimelineVisible: boolean;
  toggleTimelineVisible: () => void;
  getResponseBody: (networkLog: NetworkLog) => Promise<unknown>;
}

const NetworkContext = createContext<NetworkProviderProps>({
  ...networkTrackerInitialState,
  isScrolling: false,
  toggleScrolling: () => {},
  isTimelineVisible: true,
  toggleTimelineVisible: () => {},
  getResponseBody: async () => undefined,
});

// TODO: Use an enum with all possible call types if there will be more than one.
// TODO: Move to share frontend-backend consts file
const CDP_CALL = "cdp-call";

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();

  const [isTimelineVisible, toggleTimelineVisible] = useReducer((state) => !state, true);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);
  const [responseBodies, setResponseBodies] = useState<Record<string, unknown>>({});

  const clearActivity = () => {
    networkTracker.clearActivity();
    setResponseBodies({});
  };

  const getResponseBody = (networkLog: NetworkLog) => {
    const ws = networkTracker.ws;
    if (responseBodies[networkLog.requestId]) {
      return Promise.resolve(responseBodies[networkLog.requestId]);
    }

    const id = Math.random().toString(36).substring(7);

    vscode.postMessage({
      command: CDP_CALL,
      id,
      method: "Network.getResponseBody",
      params: {
        requestId: networkLog.requestId,
      },
    });

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
      isScrolling,
      toggleScrolling,
      isTimelineVisible,
      toggleTimelineVisible,
      getResponseBody,
      clearActivity,
    };
  }, [isScrolling, isTimelineVisible, networkTracker]);

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
