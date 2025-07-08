import { Disposable, EventEmitter } from "vscode";
import { extensionContext } from "../../utilities/extensionContext";
import { isServerOnline } from "../shared/api";

export class ConnectionListener {
  connectionSuccessEmitter: EventEmitter<boolean>;
  connectionChangeEmitter: EventEmitter<void>;
  connectionListeningInterval: NodeJS.Timeout | null;
  isOnline: boolean;

  constructor() {
    this.connectionSuccessEmitter = new EventEmitter();
    this.connectionChangeEmitter = new EventEmitter();
    this.connectionListeningInterval = null;
    this.isOnline = true;

    isServerOnline().then((isOnline) => {
      this.isOnline = isOnline;
    });

    this.connectionSuccessEmitter.event((isOnline) => {
      if (this.isOnline === isOnline) {
        return; // Status hasn't changed - no-op
      }

      this.isOnline = isOnline;

      if (this.isOnline) {
        // Connection restored
        this.tryClearListeningInterval();
        this.connectionChangeEmitter.fire();
      } else {
        // Connection lost - ping server until first response
        extensionContext.subscriptions.push(this.listenForConnection());
      }
    });
  }

  private tryClearListeningInterval() {
    if (this.connectionListeningInterval) {
      clearInterval(this.connectionListeningInterval);
    }
  }

  private listenForConnection() {
    this.connectionListeningInterval = setInterval(async () => {
      const isOnline = await isServerOnline();

      if (isOnline && this.connectionListeningInterval) {
        this.connectionSuccessEmitter.fire(isOnline);
        clearInterval(this.connectionListeningInterval);
      }
    });

    return new Disposable(this.tryClearListeningInterval);
  }

  public onConnectionChange(callback: () => unknown) {
    extensionContext.subscriptions.push(this.connectionChangeEmitter.event(callback));
  }

  public announceConnectionLost() {
    this.connectionSuccessEmitter.fire(false);
  }

  public announceConnectionFound() {
    this.connectionSuccessEmitter.fire(true);
  }
}
