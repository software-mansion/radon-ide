import { IncomingMessage } from "http";
import { EventEmitter } from "vscode";
import {
  Connection,
  IProtocolCommand,
  IProtocolError,
  IProtocolSuccess,
  Server,
  WebSocketTransport,
} from "vscode-cdp-proxy";
import { Logger } from "../Logger";

export class CDPProxy {
  private server: Server | null = null;
  private hostAddress: string;
  private port: number;
  private debuggerTarget: Connection | null = null;
  private applicationTarget: Connection | null = null;
  private browserInspectUri: string;
  private applicationTargetEventEmitter: EventEmitter<unknown> = new EventEmitter();

  public readonly onApplicationTargetConnectionClosed = this.applicationTargetEventEmitter.event;

  constructor(hostAddress: string, port: number) {
    this.port = port;
    this.hostAddress = hostAddress;
    this.browserInspectUri = "";
  }

  public async initializeServer(): Promise<void> {
    this.server = await Server.create({ port: this.port, host: this.hostAddress });
    this.server.onConnection(this.onConnectionHandler.bind(this));
  }

  public async stopServer(): Promise<void> {
    if (this.server) {
      this.server.dispose();
      this.server = null;
    }

    if (this.applicationTarget) {
      await this.applicationTarget.close();
      this.applicationTarget = null;
    }

    this.browserInspectUri = "";
  }

  public setBrowserInspectUri(browserInspectUri: string): void {
    this.browserInspectUri = browserInspectUri;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async onConnectionHandler([debuggerTarget, request]: [
    Connection,
    IncomingMessage
  ]): Promise<void> {
    this.debuggerTarget = debuggerTarget;

    this.debuggerTarget.pause(); // don't listen for events until the target is ready

    this.applicationTarget = new Connection(
      await WebSocketTransport.create(this.browserInspectUri)
    );

    this.applicationTarget.onError(this.onApplicationTargetError.bind(this));
    this.debuggerTarget.onError(this.onDebuggerTargetError.bind(this));

    this.applicationTarget.onCommand(this.handleApplicationTargetCommand.bind(this));
    this.debuggerTarget.onCommand(this.handleDebuggerTargetCommand.bind(this));

    this.applicationTarget.onReply(this.handleApplicationTargetReply.bind(this));
    this.debuggerTarget.onReply(this.handleDebuggerTargetReply.bind(this));

    this.applicationTarget.onEnd(this.onApplicationTargetClosed.bind(this));
    this.debuggerTarget.onEnd(this.onDebuggerTargetClosed.bind(this));

    // dequeue any messages we got in the meantime
    this.debuggerTarget.unpause();
  }

  private handleDebuggerTargetCommand(event: IProtocolCommand) {
    // const processedMessage = this.CDPMessageHandler.processDebuggerCDPMessage(event);

    // if (processedMessage.sendBack) {
    //   this.debuggerTarget?.send(processedMessage.event);
    // } else {
    //   this.applicationTarget?.send(processedMessage.event);
    // }
    console.log("Debugger Target Command", event);
    this.applicationTarget?.send(event);
  }

  private handleApplicationTargetCommand(event: IProtocolCommand) {
    // const processedMessage = this.CDPMessageHandler.processApplicationCDPMessage(event);

    // if (processedMessage.sendBack) {
    //   this.applicationTarget?.send(processedMessage.event);
    // } else {
    //   this.debuggerTarget?.send(processedMessage.event);
    // }
    console.log("Application Target Command", event);
    this.debuggerTarget?.send(event);
  }

  private handleDebuggerTargetReply(event: IProtocolError | IProtocolSuccess) {
    // const processedMessage = this.CDPMessageHandler.processDebuggerCDPMessage(event);

    // if (processedMessage.sendBack) {
    //   this.debuggerTarget?.send(processedMessage.event);
    // } else {
    //   this.applicationTarget?.send(processedMessage.event);
    // }
    console.log("Debugger Target Reply", event);
    this.applicationTarget?.send(event);
  }

  private handleApplicationTargetReply(event: IProtocolError | IProtocolSuccess) {
    // const processedMessage = this.CDPMessageHandler.processApplicationCDPMessage(event);

    // if (processedMessage.sendBack) {
    //   this.applicationTarget?.send(processedMessage.event);
    // } else {
    //   this.debuggerTarget?.send(processedMessage.event);
    // }
    console.log("Application Target Reply", event);
    this.debuggerTarget?.send(event);
  }

  private onDebuggerTargetError(err: Error) {
    Logger.error("Error on debugger transport", err);
  }

  private onApplicationTargetError(err: Error) {
    Logger.error("Error on application transport", err);
  }

  private async onApplicationTargetClosed() {
    this.applicationTarget = null;
    this.applicationTargetEventEmitter.fire({});
  }

  private async onDebuggerTargetClosed() {
    this.browserInspectUri = "";
    this.debuggerTarget = null;
  }
}
