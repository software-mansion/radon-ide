import WebSocket from "ws";
import { Logger } from "../Logger";

type ResolveType<T = unknown> = (result: T) => void;
type RejectType = (error: unknown) => void;

type PromiseHandlers<T = unknown> = {
  resolve: ResolveType<T>;
  reject: RejectType;
};

export class CDPSession {
  private connection: WebSocket;

  private cdpMessageId = 0;
  private cdpMessagePromises: Map<number, PromiseHandlers> = new Map();

  constructor(
    websocketAddress: string,
    onConnectionClosed: () => void,
    onIncomingCDPMethod: (message: any) => Promise<void>
  ) {
    this.connection = new WebSocket(websocketAddress);

    this.connection.on("open", this.setUpDebugger);

    this.connection.on("close", onConnectionClosed);

    this.connection.on("message", async (data) => {
      const message = JSON.parse(data.toString());
      if (message.result || message.error) {
        this.handleCDPMessageResponse(message);
        return;
      }
      await onIncomingCDPMethod(message);
    });
  }

  private setUpDebugger = async () => {
    // the below catch handler is used to ignore errors coming from non critical CDP messages we
    // expect in some setups to fail
    const ignoreError = () => {};
    await this.sendCDPMessage("FuseboxClient.setClientMetadata", {}).catch(ignoreError);
    await this.sendCDPMessage("Runtime.enable", {});
    await this.sendCDPMessage("Debugger.enable", { maxScriptsCacheSize: 100000000 });
    await this.sendCDPMessage("Debugger.setPauseOnExceptions", { state: "none" });
    await this.sendCDPMessage("Debugger.setAsyncCallStackDepth", { maxDepth: 32 }).catch(
      ignoreError
    );
    await this.sendCDPMessage("Debugger.setBlackboxPatterns", { patterns: [] }).catch(ignoreError);
    await this.sendCDPMessage("Runtime.runIfWaitingForDebugger", {}).catch(ignoreError);
  };

  private handleCDPMessageResponse(message: any) {
    const messagePromise = this.cdpMessagePromises.get(message.id);
    this.cdpMessagePromises.delete(message.id);
    if (message.result && messagePromise?.resolve) {
      messagePromise.resolve(message.result);
    } else if (message.error && messagePromise?.reject) {
      Logger.warn("CDP message error received", message.error);
      // create an error object such that we can capture stack trace and assign
      // all object error properties as provided by CDP
      const error = new Error();
      Object.assign(error, message.error);
      messagePromise.reject(error);
    }
  }

  public closeConnection() {
    this.connection.close();
  }

  public async sendCDPMessage(method: string, params: object) {
    const message = {
      id: ++this.cdpMessageId,
      method: method,
      params: params,
    };
    this.connection.send(JSON.stringify(message));
    return new Promise<any>((resolve, reject) => {
      this.cdpMessagePromises.set(message.id, { resolve, reject });
    });
  }
}
