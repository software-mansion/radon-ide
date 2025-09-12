import { Disposable } from "vscode";
import { Output } from "../common/OutputChannel";
import { createReadableOutputChannel, ReadableLogOutputChannel } from "./ReadableLogOutputChannel";

type OutputExceptIde = Exclude<Output, Output.Ide>;

export class OutputChannelRegistry implements Disposable {
  private static instance: OutputChannelRegistry | null = null;
  private channelByName = new Map<OutputExceptIde, ReadableLogOutputChannel>([]);

  public static getOrCreateOutputChannel(channel: OutputExceptIde): ReadableLogOutputChannel {
    if (!this.instance) {
      throw new Error(
        "Cannot get or create output channel - OutputChannelRegistry is not initialized."
      );
    }

    const logOutput = this.instance.channelByName.get(channel);

    if (logOutput) {
      return logOutput;
    }

    const newOutputChannel = createReadableOutputChannel(channel);
    this.instance.channelByName.set(channel, newOutputChannel);
    return newOutputChannel;
  }

  public static initializeInstance(): OutputChannelRegistry {
    // Using `initializeInstance` instead of a single `getOrInitializeInstance` prevents Logger
    // from constructing OutputChannelRegistry after `dispose` has been already called.

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
