import { LogOutputChannel, window } from "vscode";

// Some builds churn out +45k lines of logs.
// We're only interested in the first 50 and last 150 of them.
// These numbers are arbitriary and work well.
const KEEP_FIRST_N = 50;
const KEEP_LAST_N = 150;

export interface ReadableLogOutputChannel extends LogOutputChannel {
  readAll: () => string[];
  isEmpty: () => boolean;
}

export function createReadableOutputChannel(channel: string): ReadableLogOutputChannel {
  const outputChannel = window.createOutputChannel(channel, { log: true });

  const logTail: string[] = [];
  const logHead: string[] = [];
  let droppedLogsCounter = 0;

  const storeLog = (value: string) => {
    if (logTail.length < KEEP_FIRST_N) {
      logTail.push(value);
      return;
    }

    logHead.push(value);

    if (logHead.length >= KEEP_LAST_N) {
      // FIXME: Method `shift` is inefficient. Consider using a rotating buffer.
      logHead.shift();
      droppedLogsCounter++;
    }
  };

  const readAll = (): string[] => {
    if (droppedLogsCounter > 0) {
      return [
        ...logTail,
        `\n...\n\n[SKIPPED ${droppedLogsCounter} LINES OF LOGS]\n\n...\n\n`,
        ...logHead,
      ];
    }

    return [...logTail, ...logHead];
  };

  return {
    ...outputChannel,
    readAll,
    isEmpty: () => {
      return !logTail.length;
    },
    clear: () => {
      logTail.length = 0;
      logHead.length = 0;
      droppedLogsCounter = 0;
      outputChannel.clear();
    },
    append: (value: string) => {
      storeLog(value);
      outputChannel.append(value);
    },
    appendLine: (value: string) => {
      storeLog(value + "\n");
      outputChannel.appendLine(value);
    },
  };
}
