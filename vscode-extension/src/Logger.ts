import { window } from "vscode";

const outputChannel = window.createOutputChannel("React Native IDE", { log: true });

const logger = {
  log(message: string, ...args: any[]) {},

  debug(message: string, ...args: any[]) {
    // For the time being, we promote all 'debug' logs to 'info' level such that they show up by default
    // without the user changing the log level setting.
    outputChannel.info(message, ...args);
  },

  info(message: string, ...args: any[]) {
    outputChannel.info(message, ...args);
  },

  warn(message: string, ...args: any[]) {
    outputChannel.error(message, ...args);
  },

  error(message: string, ...args: any[]) {
    outputChannel.error(message, ...args);
  },

  openOutputPanel() {
    outputChannel.show();
  },
};

let devModeLoggingEnabled = false;

export function enableDevModeLogging() {
  if (devModeLoggingEnabled) {
    return;
  }
  devModeLoggingEnabled = true;

  function wrapConsole(methodName: "log" | "debug" | "info" | "warn" | "error") {
    const origMethod = logger[methodName];
    const consoleMethod = console[methodName !== "debug" ? methodName : "log"];
    logger[methodName] = (message: string, ...args: any[]) => {
      origMethod(message, ...args);
      consoleMethod(message, ...args);
    };
  }

  ["log", "debug", "info", "warn", "error"].forEach(wrapConsole);
}

export class Logger {
  public static openOutputPanel() {
    logger.openOutputPanel();
  }

  // Logs will only appear in development output
  public static log(message: string, ...args: any[]) {
    logger.log(message, ...args);
  }

  // Debug is for verbose messaging that can be seen by the extension user if they have DEBUG logging level specified
  public static debug(message: string, ...args: any[]) {
    logger.debug(message, ...args);
  }

  // Info and other type of messages will be visible by the extension user by default
  public static info(message: string, ...args: any[]) {
    logger.info(message, ...args);
  }

  public static warn(message: string, ...args: any[]) {
    logger.warn(message, ...args);
  }

  public static error(message: string, ...args: any[]) {
    logger.error(message, ...args);
  }
}
