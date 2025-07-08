import { Disposable, EventEmitter } from "vscode";
import { extensionContext } from "../../utilities/extensionContext";
import { isServerOnline } from "./api";

const PING_INTERVAL = 5000;

export class ConnectionListener {
  connectionChangeEmitter: EventEmitter<void>;
  connectionListeningInterval: NodeJS.Timeout | null;
  isOnline: boolean;

  constructor() {
    this.connectionChangeEmitter = new EventEmitter();
    this.connectionListeningInterval = null;
    this.isOnline = true;

    isServerOnline().then((isOnline) => {
      this.isOnline = isOnline;

      if (!isOnline) {
        this.tryRestoringConnection();
      }
    });
  }

  private tryClearListeningInterval() {
    if (this.connectionListeningInterval) {
      clearInterval(this.connectionListeningInterval);
    }
  }

  public tryRestoringConnection() {
    this.connectionListeningInterval = setInterval(async () => {
      const isOnline = await isServerOnline();

      if (isOnline && this.connectionListeningInterval) {
        this.tryClearListeningInterval();
        this.connectionChangeEmitter.fire();
      }
    }, PING_INTERVAL);

    extensionContext.subscriptions.push(new Disposable(() => this.tryClearListeningInterval()));
  }

  public onConnectionRestored(callback: () => unknown) {
    extensionContext.subscriptions.push(this.connectionChangeEmitter.event(callback));
  }
}
