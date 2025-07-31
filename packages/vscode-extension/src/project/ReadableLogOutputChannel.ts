import { LogOutputChannel, window } from "vscode";

export interface ReadableLogOutputChannel extends LogOutputChannel {
  readAll: () => string[];
}

export function createReadableOutputChannel(channel: string): ReadableLogOutputChannel {
  const outputChannel = window.createOutputChannel(channel, { log: true });

  const logRegistry: string[] = [];

  return {
    ...outputChannel,
    readAll: () => logRegistry,
    append: (value: string) => {
      logRegistry.push(value);
      outputChannel.append(value);
    },
    appendLine: (value: string) => {
      logRegistry.push(value);
      outputChannel.appendLine(value);
    },
  };
}
