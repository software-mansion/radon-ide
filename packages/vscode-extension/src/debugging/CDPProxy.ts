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
  ): Promise<IProtocolCommand | IProtocolReply | undefined>;
  handleDebuggerCommand(
    command: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand | IProtocolReply | undefined>;
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
  public get port() {
    return this.server?.address.port;
  }

  constructor(
    public readonly hostAddress: string,
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

    if (this.tunnel) {
      const tunnel = this.tunnel;
      this.tunnel = null;
      await tunnel?.close();
    }

    this.browserInspectUri = "";
  }

  public setBrowserInspectUri(browserInspectUri: string): void {
    this.browserInspectUri = browserInspectUri;
  }

  public injectDebuggerCommand(command: IProtocolCommand): Promise<object> {
    if (!this.tunnel) {
      return Promise.reject(new Error("CDP connection not established"));
    }
    return this.tunnel.injectDebuggerCommand(command);
  }

  public injectApplicationCommand(command: IProtocolCommand): Promise<object> {
    if (!this.tunnel) {
      return Promise.reject(new Error("CDP connection not established"));
    }
    return this.tunnel.injectApplicationCommand(command);
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

type PromiseResolvers<T> = {
  resolve: (value: T) => void;
  reject: (error?: any) => void;
};

function resolveWithReply(resolvers: PromiseResolvers<object>, reply: IProtocolReply) {
  if ("error" in reply) {
    resolvers.reject(reply.error);
    return;
  }
  resolvers.resolve(reply.result);
}

export class ProxyTunnel {
  private applicationTarget: Connection | null;
  private debuggerTarget: Connection | null;
  private nextInjectedDebuggerCommandId = 1e9;
  private nextInjectedApplicationCommandId = 1e9;

  private debuggerReplyResolvers: Map<number, PromiseResolvers<object>> = new Map();
  private applicationReplyResolvers: Map<number, PromiseResolvers<object>> = new Map();

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

  public async injectDebuggerCommand(command: IProtocolCommand): Promise<object> {
    const { promise, resolve, reject } = Promise.withResolvers<object>();
    command.id ??= this.nextInjectedDebuggerCommandId++;
    this.applicationTarget?.send(command);
    this.applicationReplyResolvers.set(command.id, { resolve, reject });
    return promise;
  }

  public async injectApplicationCommand(command: IProtocolCommand): Promise<object> {
    const { promise, resolve, reject } = Promise.withResolvers<object>();
    command.id ??= this.nextInjectedApplicationCommandId++;
    this.debuggerTarget?.send(command);
    this.debuggerReplyResolvers.set(command.id, { resolve, reject });
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

  private isProtocolReply(message: any): message is IProtocolReply {
    return "result" in message || "error" in message;
  }

  private async handleDebuggerTargetCommand(event: IProtocolCommand) {
    const processedMessage = await this.cdpProxyDelegate.handleDebuggerCommand(event, this);
    if (!processedMessage) {
      return;
    }

    if (this.isProtocolReply(processedMessage)) {
      this.debuggerTarget?.send(processedMessage);
    } else {
      this.applicationTarget?.send(processedMessage);
    }
  }

  private async handleApplicationTargetCommand(event: IProtocolCommand) {
    const processedMessage = await this.cdpProxyDelegate.handleApplicationCommand(event, this);
    if (!processedMessage) {
      return;
    }

    if (this.isProtocolReply(processedMessage)) {
      this.applicationTarget?.send(processedMessage);
    } else {
      this.debuggerTarget?.send(processedMessage);
    }
  }

  private async handleDebuggerTargetReply(event: IProtocolReply) {
    const resolvers = this.debuggerReplyResolvers.get(event.id);
    if (resolvers) {
      this.debuggerReplyResolvers.delete(event.id);
      resolveWithReply(resolvers, event);
      return;
    }

    const processedMessage = await this.cdpProxyDelegate.handleDebuggerReply(event, this);
    if (processedMessage) {
      this.applicationTarget?.send(processedMessage);
    }
  }

  private async handleApplicationTargetReply(event: IProtocolReply) {
    const resolvers = this.applicationReplyResolvers.get(event.id);
    if (resolvers) {
      this.applicationReplyResolvers.delete(event.id);
      resolveWithReply(resolvers, event);
      return;
    }

    const processedMessage = await this.cdpProxyDelegate.handleApplicationReply(event, this);
    if (processedMessage) {
      this.debuggerTarget?.send(processedMessage);
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
