import { LogOutputChannel, window } from "vscode";

export interface ReadableLogOutputChannel extends LogOutputChannel {
  readAll: () => string[];
}

export function createReadableOutputChannel(channel: string): ReadableLogOutputChannel {
  const blindOutput = window.createOutputChannel(channel, { log: true });

  const logRegistry: string[] = [];

  return {
    ...blindOutput,
    readAll: () => logRegistry,
    append: (value: string) => {
      logRegistry.push(value);
      blindOutput.append(value);
    },
    appendLine: (value: string) => {
      logRegistry.push(value);
      blindOutput.appendLine(value);
    },
  };
}
