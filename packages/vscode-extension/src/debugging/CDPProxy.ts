import { IncomingMessage } from "http";
import {
  Connection,
  IProtocolCommand,
  IProtocolError,
  IProtocolSuccess,
  Server,
  WebSocketTransport,
} from "vscode-cdp-proxy";
import { Logger } from "../Logger";

type IProtocolReply = IProtocolSuccess | IProtocolError;

export interface CDPProxyDelegate {
  handleApplicationCommand(
    command: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand | undefined>;
  handleDebuggerCommand(
    command: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand | undefined>;
  handleApplicationReply(
    reply: IProtocolReply,
    tunnel: ProxyTunnel
  ): Promise<IProtocolReply | undefined>;
  handleDebuggerReply(
    reply: IProtocolReply,
    tunnel: ProxyTunnel
  ): Promise<IProtocolReply | undefined>;
}

export class CDPProxy {
  private server: Server | null = null;
  private tunnel: ProxyTunnel | null = null;

  constructor(
    public readonly hostAddress: string,
    public readonly port: number,
    private browserInspectUri: string,
    private cdpProxyDelegate: CDPProxyDelegate
  ) {}

  public async initializeServer(): Promise<void> {
    if (this.server) {
      return;
    }
    this.server = await Server.create({ port: this.port, host: this.hostAddress });
    this.server.onConnection(this.onConnectionHandler.bind(this));
  }

  public async stopServer(): Promise<void> {
    if (this.server) {
      this.server.dispose();
      this.server = null;
    }

    await this.tunnel?.close();

    this.browserInspectUri = "";
  }

  public setBrowserInspectUri(browserInspectUri: string): void {
    this.browserInspectUri = browserInspectUri;
  }

  public injectDebuggerCommand(command: IProtocolCommand & { id: number }): void {
    this.tunnel?.injectDebuggerCommand(command);
  }

  public injectApplicationCommand(command: IProtocolCommand & { id: number }): void {
    this.tunnel?.injectApplicationCommand(command);
  }

  private async onConnectionHandler([debuggerTarget, request]: [
    Connection,
    IncomingMessage
  ]): Promise<void> {
    debuggerTarget = debuggerTarget;

    debuggerTarget.pause(); // don't listen for events until the target is ready

    const applicationTarget = new Connection(
      await WebSocketTransport.create(this.browserInspectUri)
    );

    this.tunnel = new ProxyTunnel(applicationTarget, debuggerTarget, this.cdpProxyDelegate);

    // dequeue any messages we got in the meantime
    debuggerTarget.unpause();
  }
}

export class ProxyTunnel {
  private applicationTarget: Connection | null;
  private debuggerTarget: Connection | null;

  private injectedApplicationCommandReplyResolvers: Map<number, (reply: IProtocolReply) => void> =
    new Map();
  private injectedDebuggerCommandReplyResolvers: Map<number, (reply: IProtocolReply) => void> =
    new Map();

  constructor(
    applicationTarget: Connection,
    debuggerTarget: Connection,
    private cdpProxyDelegate: CDPProxyDelegate
  ) {
    this.applicationTarget = applicationTarget;
    this.debuggerTarget = debuggerTarget;

    this.applicationTarget.onError(this.onApplicationTargetError.bind(this));
    this.debuggerTarget.onError(this.onDebuggerTargetError.bind(this));

    this.applicationTarget.onCommand(this.handleApplicationTargetCommand.bind(this));
    this.debuggerTarget.onCommand(this.handleDebuggerTargetCommand.bind(this));

    this.applicationTarget.onReply(this.handleApplicationTargetReply.bind(this));
    this.debuggerTarget.onReply(this.handleDebuggerTargetReply.bind(this));

    this.applicationTarget.onEnd(this.onApplicationTargetClosed.bind(this));
    this.debuggerTarget.onEnd(this.onDebuggerTargetClosed.bind(this));
  }

  public async injectDebuggerCommand(
    command: IProtocolCommand & { id: number }
  ): Promise<IProtocolReply> {
    this.applicationTarget?.send(command);
    const { promise, resolve } = Promise.withResolvers<IProtocolReply>();
    this.injectedDebuggerCommandReplyResolvers.set(command.id, resolve);
    return promise;
  }

  public async injectApplicationCommand(
    command: IProtocolCommand & { id: number }
  ): Promise<IProtocolReply> {
    this.debuggerTarget?.send(command);
    const { promise, resolve } = Promise.withResolvers<IProtocolReply>();
    this.injectedApplicationCommandReplyResolvers.set(command.id, resolve);
    return promise;
  }

  public async close(): Promise<void> {
    if (this.applicationTarget) {
      await this.applicationTarget.close();
      this.applicationTarget = null;
    }

    if (this.debuggerTarget) {
      await this.debuggerTarget.close();
      this.debuggerTarget = null;
    }
  }

  private async handleDebuggerTargetCommand(event: IProtocolCommand) {
    const processedMessage = await this.cdpProxyDelegate.handleDebuggerCommand(event, this);
    if (processedMessage) {
      this.applicationTarget?.send(event);
    }
  }

  private async handleApplicationTargetCommand(event: IProtocolCommand) {
    const processedMessage = await this.cdpProxyDelegate.handleApplicationCommand(event, this);
    if (processedMessage) {
      this.debuggerTarget?.send(event);
    }
  }

  private async handleDebuggerTargetReply(event: IProtocolReply) {
    const resolve = this.injectedApplicationCommandReplyResolvers.get(event.id);
    if (resolve) {
      resolve(event);
      this.injectedApplicationCommandReplyResolvers.delete(event.id);
      return;
    }

    const processedMessage = await this.cdpProxyDelegate.handleDebuggerReply(event, this);
    if (processedMessage) {
      this.applicationTarget?.send(processedMessage);
    }
  }

  private async handleApplicationTargetReply(event: IProtocolReply) {
    const resolve = this.injectedDebuggerCommandReplyResolvers.get(event.id);
    if (resolve) {
      resolve(event);
      this.injectedDebuggerCommandReplyResolvers.delete(event.id);
      return;
    }

    const processedMessage = await this.cdpProxyDelegate.handleApplicationReply(event, this);
    if (processedMessage) {
      this.debuggerTarget?.send(event);
    }
  }

  private onDebuggerTargetError(err: Error) {
    Logger.error("Error on debugger transport", err);
  }

  private onApplicationTargetError(err: Error) {
    Logger.error("Error on application transport", err);
  }

  private async onApplicationTargetClosed() {
    this.applicationTarget = null;
    await this.close();
  }

  private async onDebuggerTargetClosed() {
    this.debuggerTarget = null;
    await this.close();
  }
}
