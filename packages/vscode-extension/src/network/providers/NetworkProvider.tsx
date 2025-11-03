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
import { WebviewMessage, WebviewCommand, IDEMethod, IDEType } from "../types/panelMessageProtocol";
import { ResponseBodyData } from "../types/network";
import { ThemeDescriptor, ThemeData } from "../../common/theme";

interface NetworkProviderProps extends NetworkTracker {
  isRecording: boolean;
  isScrolling: boolean;
  toggleRecording: () => void;
  clearActivity: () => void;
  toggleScrolling: () => void;
  isTimelineVisible: boolean;
  toggleTimelineVisible: () => void;
  fetchAndOpenResponseInEditor: (networkLog: NetworkLog, base64encoded: boolean) => Promise<void>;
  getResponseBody: (networkLog: NetworkLog) => Promise<ResponseBodyData | undefined>;
  getThemeData: (themeDescriptor: ThemeDescriptor) => Promise<ThemeData>;
}

function createBodyResponsePromise(
  messageId: string,
  requestId: string,
  responseBodiesRef: React.RefObject<Record<string, ResponseBodyData | undefined>>
) {
  const { promise, resolve } = Promise.withResolvers<ResponseBodyData | undefined>();

  const listener = (message: MessageEvent) => {
    try {
      const { payload, command }: WebviewMessage = message.data;
      if (payload.messageId !== messageId || command !== WebviewCommand.IDECall) {
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

  // Setup listener to capture the response
  window.addEventListener("message", listener);

  return promise;
}

function createThemeResponsePromise(messageId: string) {
  const { promise, resolve } = Promise.withResolvers<ThemeData>();

  const listener = (message: MessageEvent) => {
    try {
      const { payload }: WebviewMessage = message.data;
      if (payload.method !== IDEType.Theme || payload.messageId !== messageId) {
        return;
      }

      const themeData = payload.result as ThemeData;

      resolve(themeData);
      window.removeEventListener("message", listener);
    } catch (error) {
      console.error("Error parsing Window message:", error);
    }
  };

  // Setup listener to capture the response
  window.addEventListener("message", listener);

  return promise;
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
  getThemeData: async () => ({}),
});

export default function NetworkProvider({ children }: PropsWithChildren) {
  const networkTracker = useNetworkTracker();
  const { clearLogs, toggleNetwork, sendWebviewIDEMessage, networkLogs } = networkTracker;

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
    const { requestId, type } = networkLog;

    if (!requestId) {
      return Promise.resolve(undefined);
    }

    if (responseBodiesRef.current[requestId]) {
      return Promise.resolve(responseBodiesRef.current[requestId]);
    }

    const messageId = Math.random().toString(36).substring(7);
    const promise = createBodyResponsePromise(messageId, requestId, responseBodiesRef);

    // Send the message to the network-plugin backend
    sendWebviewIDEMessage({
      messageId: messageId,
      method: IDEMethod.GetResponseBodyData,
      params: {
        requestId,
        type,
      },
    });

    return promise;
  };
  const getThemeData = (themeDescriptor: ThemeDescriptor): Promise<ThemeData> => {
    const messageId = Math.random().toString(36).substring(7);
    const promise = createThemeResponsePromise(messageId);

    // Send the message to the network-plugin backend
    sendWebviewIDEMessage({
      method: IDEMethod.GetTheme,
      messageId: messageId,
      params: {
        themeDescriptor,
      },
    });

    return promise;
  };

  const fetchAndOpenResponseInEditor = async (networkLog: NetworkLog, base64Encoded: boolean) => {
    const requestId = networkLog.requestId;
    const request = networkLog.request;

    if (!requestId || !request) {
      return Promise.resolve(undefined);
    }

    const id = Math.random().toString(36).substring(7);

    sendWebviewIDEMessage({
      messageId: id,
      method: IDEMethod.FetchFullResponseBody,
      params: {
        request: request,
        base64Encoded: base64Encoded,
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
