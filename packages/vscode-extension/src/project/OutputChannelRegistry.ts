import { Disposable } from "vscode";
import { Output } from "../common/OutputChannel";
import { createReadableOutputChannel, ReadableLogOutputChannel } from "./ReadableLogOutputChannel";

type OutputExceptIde = Exclude<Output, Output.Ide>;

export class OutputChannelRegistry implements Disposable {
  private channelByName = new Map<OutputExceptIde, ReadableLogOutputChannel>();

  getOrCreateOutputChannel(channel: OutputExceptIde): ReadableLogOutputChannel {
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
      c.dispose();
    });
  }
}
