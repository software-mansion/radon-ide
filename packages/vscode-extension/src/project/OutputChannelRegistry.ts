import { Disposable } from "vscode";
import { Output } from "../common/OutputChannel";
import { createReadableOutputChannel, ReadableLogOutputChannel } from "./ReadableLogOutputChannel";

const hiddenOutputChannels = [Output.MetroBundler];

export class OutputChannelRegistry implements Disposable {
  private static instance: OutputChannelRegistry | null = null;
  private channelByName = new Map<Output, ReadableLogOutputChannel>([]);

  getOrCreateOutputChannel(channel: Output): ReadableLogOutputChannel {
    const logOutput = this.channelByName.get(channel);

    if (logOutput) {
      return logOutput;
    }

    const newOutputChannel = createReadableOutputChannel(
      channel,
      !hiddenOutputChannels.includes(channel)
    );

    this.channelByName.set(channel, newOutputChannel);

    return newOutputChannel;
  }

  public static getInstanceIfExists(): OutputChannelRegistry | null {
    return this.instance;
  }

  public static initializeInstance(): OutputChannelRegistry {
    // Using `initializeInstance` in combination with `getInstanceIfExists` instead of a single `getInstance`
    // prevents Logger from constructing OutputChannelRegistry after `dispose` has been already called.
    if (this.getInstanceIfExists()) {
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
