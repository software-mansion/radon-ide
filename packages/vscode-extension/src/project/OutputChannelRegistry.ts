import { Disposable } from "vscode";
import { Output } from "../common/OutputChannel";
import {
  createReadableOutputChannel,
  OutputChannelVisibility,
  ReadableLogOutputChannel,
} from "./ReadableLogOutputChannel";

export class OutputChannelRegistry implements Disposable {
  private channelByName = new Map<Output, ReadableLogOutputChannel>([]);

  getOrCreateOutputChannel(
    channel: Output,
    visibility: OutputChannelVisibility = OutputChannelVisibility.Visible
  ): ReadableLogOutputChannel {
    const logOutput = this.channelByName.get(channel);

    if (logOutput) {
      return logOutput;
    }

    const newOutputChannel = createReadableOutputChannel(channel, visibility);
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
