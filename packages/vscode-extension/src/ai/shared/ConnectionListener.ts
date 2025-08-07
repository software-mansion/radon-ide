import { Disposable, EventEmitter } from "vscode";
import { isServerOnline } from "./api";

const PING_INTERVAL = 5000;

export class ConnectionListener implements Disposable {
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

  dispose() {
    this.tryClearListeningInterval();
    this.connectionRestoredEmitter.dispose();
  }

  tryRestoringConnection() {
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
  }

  onConnectionRestored(callback: () => unknown): Disposable {
    return this.connectionRestoredEmitter.event(callback);
  }
}
