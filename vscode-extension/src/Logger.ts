import { window } from "vscode";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type Stringifiable = {
  toString: () => string;
};

export class Logger {
  private static outputChannel = window.createOutputChannel("react-native-sztudio");
  private static messagesArchive: string[] = [];
  private static logLevel: LogLevel = "DEBUG";
  private static consoleLogEnabled: boolean = true;

  public static changeConsoleLogMode(enabled: boolean) {
    this.consoleLogEnabled = enabled;
  }

  public static setLogLevel(logLevel: LogLevel) {
    Logger.logLevel = logLevel;
  }

  public static error(message: Stringifiable, source?: string) {
    Logger.logMessage(message.toString(), "ERROR", source);
  }

  public static warn(message: Stringifiable, source?: string) {
    if (Logger.logLevel === "ERROR") {
      return;
    }
    Logger.logMessage(message.toString(), "WARN", source);
  }

  public static log(message: Stringifiable, source?: string) {
    if (Logger.logLevel === "ERROR" || Logger.logLevel === "WARN") {
      return;
    }
    Logger.logMessage(message.toString(), "INFO", source);
  }

  public static debug(message: Stringifiable, source?: string) {
    if (Logger.logLevel === "ERROR" || Logger.logLevel === "WARN" || Logger.logLevel === "INFO") {
      return;
    }
    Logger.logMessage(message.toString(), "DEBUG", source);
  }

  private static logMessage(message: string, logLevel: LogLevel, source?: string) {
    const logDate = new Date();
    const formattedDate = `${logDate.toLocaleDateString()} ${logDate.toLocaleTimeString()}`;

    const outputString = `${formattedDate} [${logLevel}] ${
      !!source?.length ? `(${source})` : ''
    } ${message}`;

    this.messagesArchive.push(outputString);
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
