import { Disposable } from "vscode";
import { Output } from "../common/OutputChannel";
import { createReadableOutputChannel, ReadableLogOutputChannel } from "./ReadableLogOutputChannel";

type OutputExceptIde = Exclude<Output, Output.Ide>;

export class OutputChannelRegistry implements Disposable {
  private static instance: OutputChannelRegistry | null = null;
  private channelByName = new Map<OutputExceptIde, ReadableLogOutputChannel>();
  private disposed = false;

  public resolveOutputChannel(channel: OutputExceptIde): ReadableLogOutputChannel {
    if (this.disposed) {
      // Prevent lingering instances of OutputChannelRegistry from being used
      throw new Error(
        "Cannot get or create output channel - this instance of OutputChannelRegistry has already been disposed."
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

  public static resolveOutputChannel(channel: OutputExceptIde): ReadableLogOutputChannel {
    if (!this.instance) {
      throw new Error(
        "Cannot get or create output channel - OutputChannelRegistry is not initialized."
      );
    }

    return this.instance.resolveOutputChannel(channel);
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

  public static getInstanceIfExists() {
    return OutputChannelRegistry.instance;
  }

  public static getInstance() {
    const instance = OutputChannelRegistry.getInstanceIfExists();

    if (!instance) {
      throw new Error("Cannot initialize IDE instance - OutputChannelRegistry is not initialized");
    }

    return instance;
  }

  public dispose() {
    this.channelByName.values().forEach((channel) => channel.dispose());
    this.channelByName.clear();
    this.disposed = true;
    OutputChannelRegistry.instance = null;
  }
}
