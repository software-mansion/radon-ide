import { Disposable } from "vscode";
import { Output } from "../common/OutputChannel";
import { createReadableOutputChannel, ReadableLogOutputChannel } from "./ReadableLogOutputChannel";

export class OutputChannelRegistry implements Disposable {
  private channelByName = new Map<Output, ReadableLogOutputChannel>();

  getOrCreateOutputChannel(channel: Output): ReadableLogOutputChannel {
    if (channel === Output.Ide) {
      throw Error(
        "Output.Ide output channel cannot be accessed through OutputChannelRegistry. Use Logger instead."
      );
    }

    const logOutput = this.channelByName.get(channel);

    if (logOutput) {
      return logOutput;
    }

    const newOutputChannel = createReadableOutputChannel(channel);

    this.channelByName.set(channel, newOutputChannel);

    return newOutputChannel;
  }

  dispose() {
    this.channelByName.values().forEach((c) => {
      c.dispose();
    });
  }
}
