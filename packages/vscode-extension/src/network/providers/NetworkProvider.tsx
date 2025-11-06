import { createContext, PropsWithChildren, useContext, useMemo, useReducer, useRef } from "react";
import useNetworkTracker, {
  NetworkTracker,
  networkTrackerInitialState,
} from "../hooks/useNetworkTracker";
import { NetworkFilterProvider } from "./NetworkFilterProvider";
import { generateId, createIDEResponsePromise } from "../utils/panelMessages";
import { NetworkLog } from "../types/networkLog";
import { IDEMethod, IDEType } from "../types/panelMessageProtocol";
import { ResponseBodyData } from "../types/network";
import { ThemeDescriptor, ThemeData } from "../../common/theme";

interface NetworkProviderProps extends NetworkTracker {
  isTracking: boolean;
  isScrolling: boolean;
  setIsTracking: React.Dispatch<React.SetStateAction<boolean>>;
  clearActivity: () => void;
  toggleScrolling: () => void;
  isTimelineVisible: boolean;
  toggleTimelineVisible: () => void;
  fetchAndOpenResponseInEditor: (networkLog: NetworkLog, base64encoded: boolean) => Promise<void>;
  getResponseBody: (networkLog: NetworkLog) => Promise<ResponseBodyData | undefined>;
  getThemeData: (themeDescriptor: ThemeDescriptor) => Promise<ThemeData>;
}

function createBodyDataResponseTransformer(
  requestId: string,
  responseBodiesRef: React.RefObject<Record<string, ResponseBodyData | undefined>>
) {
  return (result: unknown): ResponseBodyData | undefined => {
    const bodyData = result as ResponseBodyData | undefined;

    if (bodyData === undefined) {
      return responseBodiesRef.current?.[requestId];
    }

    if (responseBodiesRef.current) {
      responseBodiesRef.current[requestId] = bodyData;
    }

    return bodyData;
  };
}

const NetworkContext = createContext<NetworkProviderProps>({
  ...networkTrackerInitialState,
  isTracking: true,
  isScrolling: false,
  setIsTracking: () => {},
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
  const { clearLogs, isTracking, setIsTracking, sendWebviewIDEMessage, networkLogs } =
    networkTracker;

  const [isTimelineVisible, toggleTimelineVisible] = useReducer((state) => !state, true);
  const [isScrolling, toggleScrolling] = useReducer((state) => !state, false);
  const responseBodiesRef = useRef<Record<string, ResponseBodyData | undefined>>({});

  const clearActivity = () => {
    clearLogs();
    responseBodiesRef.current = {};
  };

  const getResponseBody = (networkLog: NetworkLog): Promise<ResponseBodyData | undefined> => {
    const { requestId, type } = networkLog;

    if (!requestId) {
      return Promise.resolve(undefined);
    }

    if (responseBodiesRef.current[requestId]) {
      return Promise.resolve(responseBodiesRef.current[requestId]);
    }

    const messageId = generateId();
    const transformer = createBodyDataResponseTransformer(requestId, responseBodiesRef);
    const promise = createIDEResponsePromise<ResponseBodyData | undefined>(
      messageId,
      IDEType.ResponseBodyData,
      transformer
    );

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
    const messageId = generateId();
    const promise = createIDEResponsePromise<ThemeData>(messageId, IDEType.Theme);

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

    const id = generateId();

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
      isTracking,
      setIsTracking,
      isScrolling,
      clearActivity,
      toggleScrolling,
      isTimelineVisible,
      toggleTimelineVisible,
      getResponseBody,
      fetchAndOpenResponseInEditor,
      getThemeData,
    };
  }, [isTracking, isScrolling, isTimelineVisible, networkTracker.networkLogs]);

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
