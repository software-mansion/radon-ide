import { PropsWithChildren, useContext, createContext } from "react";
import { makeProxy } from "../utilities/rpc";
import { Utils } from "../../utilities/utils";
import { UtilsInterface } from "../../common/utils";

declare global {
  interface Window {
    // set in generateWebviewContent()
    RNIDE_hostOS: "macos" | "windows";
  }
}

export const Platform = {
  OS: window.RNIDE_hostOS,
  select: <R, T>(obj: { macos: R; windows: T }) => {
    return obj[Platform.OS];
  },
};

const utils = makeProxy<Utils>("Utils");

const UtilsContext = createContext<UtilsInterface>(utils);

export function UtilsProvider({ children }: PropsWithChildren) {
  return <UtilsContext.Provider value={utils}>{children}</UtilsContext.Provider>;
}

export function useUtils() {
  const context = useContext(UtilsContext);

  if (context === undefined) {
    throw new Error("useUtils must be used within a UtilsContextProvider");
  }
  return context;
}

export function installLogOverrides() {
  function wrapConsole(methodName: "log" | "info" | "warn" | "error") {
    const consoleMethod = console[methodName];
    console[methodName] = (message: string, ...args: any[]) => {
      utils.log(methodName, message, ...args);
      consoleMethod(message, ...args);
    };
  }

  (["log", "info", "warn", "error"] as const).forEach(wrapConsole);

  // install uncaught exception handler
  window.addEventListener("error", (event) => {
    utils.log("error", "Uncaught exception", event.error.stack);
    // rethrow the error to be caught by the global error handler
    throw event.error;
  });

  // install uncaught promise rejection handler
  window.addEventListener("unhandledrejection", (event) => {
    utils.log("error", "Uncaught promise rejection", event.reason);
    // rethrow the error to be caught by the global error handler
    throw event.reason;
  });
}
