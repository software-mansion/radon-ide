import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import { ScanEventListener, ScanEventMap, ScanInterface } from "../common/Scan";
import { Devtools } from "../project/devtools";

export class Scan implements ScanInterface, Disposable {
  private eventEmitter = new EventEmitter();

  private devToolsListener = (event: string, payload: any): void => {
    if (event === "RNIDE_rendersReported") {
      this.eventEmitter.emit("rendersReported", payload);
    }
  };

  constructor(private devtools: Devtools) {
    this.devtools.addListener(this.devToolsListener);
  }

  dispose() {
    this.devtools.removeListener(this.devToolsListener);
  }

  addEventListener<K extends keyof ScanEventMap>(
    type: K,
    listener: ScanEventListener<ScanEventMap[K]>
  ): void {
    this.eventEmitter.addListener(type, listener);
  }
  removeEventListener<K extends keyof ScanEventMap>(
    type: K,
    listener: ScanEventListener<ScanEventMap[K]>
  ): void {
    this.eventEmitter.removeListener(type, listener);
  }
}
