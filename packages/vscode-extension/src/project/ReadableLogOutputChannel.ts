import { LogOutputChannel, window } from "vscode";
import { CircularBuffer } from "./CircularBuffer";

// Some builds churn out +45k lines of logs.
// We're only interested in the first 50 and last 150 of them.
// These numbers are arbitriary and work well.
const KEEP_FIRST_N = 50;
const KEEP_LAST_N = 150;

export interface ReadableLogOutputChannel extends LogOutputChannel {
  readAll: () => string[];
  isEmpty: () => boolean;
}

function createMockOutputChannel(): LogOutputChannel {
  // All five functions required for writing, reading and clearing logs are already implemented by `createReadableOutputChannel`.
  // Remaining functions provided by `window.createOutputChannel` are never used within our codebase, and thus don't have to be present.
  return {} as unknown as LogOutputChannel;
}

export function createReadableOutputChannel(
  channel: string,
  isVisible: boolean
): ReadableLogOutputChannel {
  const outputChannel = isVisible
    ? window.createOutputChannel(channel, { log: true })
    : createMockOutputChannel();

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
