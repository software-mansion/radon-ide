import { Disposable } from "vscode";
import { Output } from "../common/OutputChannel";
import { createReadableOutputChannel, ReadableLogOutputChannel } from "./ReadableLogOutputChannel";

const hiddenOutputChannels: Output[] = [];

export class OutputChannelRegistry implements Disposable {
  private static instance: OutputChannelRegistry | null = null;
  private channelByName = new Map<Output, ReadableLogOutputChannel>([]);

  public static getOrCreateOutputChannel(channel: Output): ReadableLogOutputChannel {
    const logOutput = this.instance?.channelByName.get(channel);

    if (logOutput) {
      return logOutput;
    }

    const newOutputChannel = createReadableOutputChannel(
      channel,
      !hiddenOutputChannels.includes(channel)
    );

    this.instance?.channelByName.set(channel, newOutputChannel);

    return newOutputChannel;
  }

  public static initializeInstance(): OutputChannelRegistry {
    // Using `initializeInstance` in combination with `getInstanceIfExists` instead of a single `getInstance`
    // prevents Logger from constructing OutputChannelRegistry after `dispose` has been already called.
    if (this.instance) {
      throw new Error("OutputChannelRegistry instance already exists.");
    }
    this.instance = new OutputChannelRegistry();
    return this.instance;
  }

  dispose() {
    this.channelByName.values().forEach((channel) => channel.dispose());
    this.channelByName.clear();
    OutputChannelRegistry.instance = null;
  }
}
