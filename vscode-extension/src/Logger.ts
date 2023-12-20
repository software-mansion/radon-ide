import { window } from "vscode";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type Stringifiable = {
  toString: () => string;
};

type ParsableMessage = Stringifiable | Object | unknown;

type IncomingMessage = ParsableMessage[] | ParsableMessage;
export class Logger {
  private static outputChannel = window.createOutputChannel("react-native-sztudio", { log: true });
  private static logLevel: LogLevel = "DEBUG";
  private static consoleLogEnabled: boolean = true;

  private static _parseMessage(message: ParsableMessage) {
    if (typeof message === "object" && !!message) {
      return JSON.stringify(message);
    }

    if (message?.toString) {
      return message.toString();
    }

    return message;
  }

  private static _parseArguments(messageParams: IncomingMessage) {
    if (Array.isArray(messageParams)) {
      const parsedParams = messageParams.map((message) => Logger._parseMessage(message));

      return parsedParams.join(" ");
    }

    return Logger._parseMessage(messageParams);
  }

  public static changeConsoleLogMode(enabled: boolean) {
    this.consoleLogEnabled = enabled;
  }

  public static openOutputChannel() {
    this.outputChannel.show();
  }

  public static setLogLevel(logLevel: LogLevel) {
    Logger.logLevel = logLevel;
  }

  public static error(messageParams: IncomingMessage, source?: string) {
    Logger.logMessage(messageParams, "ERROR", source);
  }

  public static warn(messageParams: IncomingMessage, source?: string) {
    if (Logger.logLevel === "ERROR") {
      return;
    }
    Logger.logMessage(messageParams, "WARN", source);
  }

  public static log(messageParams: IncomingMessage, source?: string) {
    if (Logger.logLevel === "ERROR" || Logger.logLevel === "WARN") {
      return;
    }
    Logger.logMessage(messageParams, "INFO", source);
  }

  public static debug(messageParams: IncomingMessage, source?: string) {
    if (Logger.logLevel === "ERROR" || Logger.logLevel === "WARN" || Logger.logLevel === "INFO") {
      return;
    }
    Logger.logMessage(messageParams, "DEBUG", source);
  }

  private static logMessage(messageParams: IncomingMessage, logLevel: LogLevel, source?: string) {
    const message = Logger._parseArguments(messageParams);
    const logDate = new Date();
    const formattedDate = `${logDate.toLocaleDateString()} ${logDate.toLocaleTimeString()}`;

    const outputString = `${formattedDate} [${logLevel}] ${
      !!source?.length ? `(${source})` : ""
    } ${message}`;

    if (Logger.consoleLogEnabled) {
      if (logLevel === "DEBUG" || logLevel === "INFO") {
        console.log(outputString);
      } else if (logLevel === "WARN") {
        console.warn(outputString);
      } else {
        console.error(outputString);
      }
    }
    Logger.outputChannel.appendLine(outputString);
  }
}
