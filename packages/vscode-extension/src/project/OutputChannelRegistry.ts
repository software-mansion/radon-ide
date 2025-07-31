import { Disposable, LogOutputChannel, window } from "vscode";
import { Output } from "../common/OutputChannel";
import { Logger } from "../Logger";

interface ReadableLogOutputChannel extends LogOutputChannel {
  readAll: () => string[];
}

function createReadableOutputChannel(channel: string): ReadableLogOutputChannel {
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

export class OutputChannelRegistry implements Disposable {
  private channelByName = new Map<Output, LogOutputChannel>([
    [Output.Ide, Logger.rawOutputChannel],
  ]);

  getOrCreateOutputChannel(channel: Output): LogOutputChannel {
    const logOutput = this.channelByName.get(channel);
    if (logOutput) {
      return logOutput;
    }

    const newOutputChannel = createReadableOutputChannel(channel);
    this.channelByName.set(channel, newOutputChannel);
    return newOutputChannel;
  }

  dispose() {
    this.channelByName.entries().forEach(([k, c]) => {
      // NOTE: we special-case the IDE output channel to keep it open
      // even when the IDE is disposed.
      if (k !== Output.Ide) {
        c.dispose();
      }
    });
  }
}
