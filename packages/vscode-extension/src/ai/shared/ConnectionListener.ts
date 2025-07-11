import { Disposable, EventEmitter } from "vscode";
import { extensionContext } from "../../utilities/extensionContext";
import { isServerOnline } from "./api";

const PING_INTERVAL = 5000;

export class ConnectionListener {
  connectionRestoredEmitter: EventEmitter<void>;
  connectionListeningInterval: NodeJS.Timeout | null;

  constructor() {
    this.connectionRestoredEmitter = new EventEmitter();
    this.connectionListeningInterval = null;

    isServerOnline().then((isOnline) => {
      if (!isOnline) {
        this.tryRestoringConnection();
      }
    });
  }

  private tryClearListeningInterval() {
    if (this.connectionListeningInterval) {
      clearInterval(this.connectionListeningInterval);
      this.connectionListeningInterval = null;
    }
  }

  public tryRestoringConnection() {
    if (this.connectionListeningInterval) {
      return; // Pings already running - no-op
    }

    this.connectionListeningInterval = setInterval(async () => {
      const isOnline = await isServerOnline();

      if (isOnline && this.connectionListeningInterval) {
        this.tryClearListeningInterval();
        this.connectionRestoredEmitter.fire();
      }
    }, PING_INTERVAL);

    extensionContext.subscriptions.push(new Disposable(() => this.tryClearListeningInterval()));
  }

  public onConnectionRestored(callback: () => unknown) {
    extensionContext.subscriptions.push(this.connectionRestoredEmitter.event(callback));
  }
}
