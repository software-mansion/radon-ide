import {
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
import { WebviewMessage, WebviewCommand } from "../types/panelMessageProtocol";
import { ResponseBodyData } from "../types/network";
import { ThemeObject } from "../../utilities/themeExtraction";

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
  getThemeData: (themeName?: string) => Promise<ThemeObject>;
}

function responseBodyListener(
  resolve: (value: ResponseBodyData | undefined) => void,
  messageId: string,
  requestId: string,
  responseBodiesRef: React.RefObject<Record<string, ResponseBodyData | undefined>>
) {
  const listener = (message: MessageEvent) => {
    try {
      const { command, payload }: WebviewMessage = message.data;
      if (command !== WebviewCommand.CDPCall || payload.id !== messageId) {
        return;
      }

      const bodyData = payload.result as ResponseBodyData | undefined;

      if (bodyData === undefined) {
        resolve(responseBodiesRef.current[requestId]);
        window.removeEventListener("message", listener);
        return;
      }

      responseBodiesRef.current[requestId] = bodyData;

      resolve(bodyData);
      window.removeEventListener("message", listener);
    } catch (error) {
      console.error("Error parsing Window message:", error);
    }
  };
  return listener;
}

function themeListener(resolve: (value: ThemeObject) => void, messageId: string) {
  const listener = (message: MessageEvent) => {
    try {
      const { payload }: WebviewMessage = message.data;
      if (payload.method !== "IDE.Theme" || payload.id !== messageId) {
        return;
      }

      const themeData = payload.result as ThemeObject;

      resolve(themeData);
      window.removeEventListener("message", listener);
    } catch (error) {
      console.error("Error parsing Window message:", error);
    }
  };

  return listener;
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
  getThemeData: async () => ({ themeType: "vscode-light" as const, themeName: "Default" }),
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();
  const { clearLogs, toggleNetwork, sendWebviewIDEMessage, sendWebviewCDPMessage, networkLogs } =
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

    if (!requestId) {
      return Promise.resolve(undefined);
    }

    if (responseBodiesRef.current[requestId]) {
      return Promise.resolve(responseBodiesRef.current[requestId]);
    }

    const messageId = Math.random().toString(36).substring(7);
    const { promise, resolve } = Promise.withResolvers<ResponseBodyData | undefined>();
    const listener = responseBodyListener(resolve, messageId, requestId, responseBodiesRef);

    // Setup listener to capture the response
    window.addEventListener("message", listener);

    // Send the message to the network-plugin backend
    sendWebviewCDPMessage({
      id: messageId,
      method: "Network.getResponseBody",
      params: {
        requestId: requestId,
      },
    });

    return promise;
  };
  const getThemeData = (themeName?: string): Promise<ThemeObject> => {
    const messageId = Math.random().toString(36).substring(7);
    const { promise, resolve } = Promise.withResolvers<ThemeObject>();

    // Setup listener to capture the response
    const listener = themeListener(resolve, messageId);
    window.addEventListener("message", listener);

    // Send the message to the network-plugin backend
    sendWebviewIDEMessage({
      method: "IDE.getTheme",
      id: messageId,
      params: {
        themeName
      }
    });

    return promise;
  };

  const fetchAndOpenResponseInEditor = async (networkLog: NetworkLog) => {
    const requestId = networkLog.requestId;
    const request = networkLog.request;

    if (!requestId || !request) {
      return Promise.resolve(undefined);
    }

    const id = Math.random().toString(36).substring(7);

    sendWebviewIDEMessage({
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
      getThemeData,
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
