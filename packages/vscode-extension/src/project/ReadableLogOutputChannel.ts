import { LogLevel, LogOutputChannel, window } from "vscode";
import { CircularBuffer } from "./CircularBuffer";
import { Output } from "../common/OutputChannel";

// Some builds churn out +45k lines of logs.
// We're only interested in the first 50 and last 150 of them.
// These numbers are arbitriary and work well.
const KEEP_FIRST_N = 50;
const KEEP_LAST_N = 150;

const hiddenOutputChannels = [Output.MetroBundler];

export interface ReadableLogOutputChannel extends LogOutputChannel {
  readAll: () => string[];
  isEmpty: () => boolean;
}

function createMockOutputChannel(channel: Output) {
  return {
    name: channel,
    logLevel: LogLevel.Info,
    dispose: () => {},
    onDidChangeLogLevel: () => {
      return { dispose: () => {} };
    },
    trace: (message: string, ...args: any[]) => {},
    debug: (message: string, ...args: any[]) => {},
    info: (message: string, ...args: any[]) => {},
    warn: (message: string, ...args: any[]) => {},
    error: (message: string, ...args: any[]) => {},
    append: (value: string) => {},
    appendLine: (value: string) => {},
    clear: () => {},
    show: () => {},
    hide: () => {},
    replace: () => {},
  };
}

export function createReadableOutputChannel(channel: Output): ReadableLogOutputChannel {
  const outputChannel = !hiddenOutputChannels.includes(channel)
    ? window.createOutputChannel(channel, { log: true })
    : createMockOutputChannel(channel);

  const logHead: string[] = [];
  const logTailBuffer = new CircularBuffer<string>(KEEP_LAST_N);

  let droppedLogsCounter = 0;

  const storeLog = (value: string) => {
    if (logHead.length < KEEP_FIRST_N) {
      logHead.push(value);
      return;
    }

    logTailBuffer.write(value);
    droppedLogsCounter++;
  };

  const readAll = (): string[] => {
    if (droppedLogsCounter > 0) {
      return [
        ...logHead,
        `\n...\n\n[SKIPPED ${droppedLogsCounter} LINES OF LOGS]\n\n...\n\n`,
        ...logTailBuffer.readAll(),
      ];
    }

    return [...logHead, ...logTailBuffer.readAll()];
  };

  return {
    ...outputChannel,
    readAll,
    isEmpty: () => {
      return !logHead.length;
    },
    clear: () => {
      droppedLogsCounter = 0;
      logHead.length = 0;
      logTailBuffer.clear();
      outputChannel.clear?.();
    },
    append: (value: string) => {
      storeLog(value);
      outputChannel.append?.(value);
    },
    appendLine: (value: string) => {
      storeLog(value + "\n");
      outputChannel.appendLine?.(value);
    },
  };
}
