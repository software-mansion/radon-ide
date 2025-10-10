import { EventEmitter } from "node:events";
import { Disposable } from "vscode";

type EventMap<K extends string> = Record<K, unknown[]>;

export interface EventDispatcher<E extends EventMap<K>, K extends string> {
  onEvent<L extends K>(event: L, listener: (...payload: E[L]) => void): Disposable;
  emitEvent: <L extends K>(event: L, payload: E[L]) => void;
}

/**
 * Abstract base class that provides an event-based bridging mechanism.
 *
 * This class manages event listeners keyed by event names and exposes:
 * - onEvent method to register listeners,
 * - emitEvent method to invoke listeners,
 *
 * @template E - Map of event names to listener-argument tuples (e.g. { foo: [number, string] }).
 * @template K - Union of string literal event names (keys of E).
 */
export abstract class EventDispatcherBase<E extends EventMap<K>, K extends string>
  implements EventDispatcher<E, K>
{
  private emitter = new EventEmitter({ captureRejections: true });

  public emitEvent: <L extends K>(event: L, payload: E[L]) => void;

  constructor() {
    this.emitEvent = this.emitter.emit.bind(this.emitter);

    this.emitter.on("error", (error) => {
      console.error("EventDispatcher error:", error);
    });
  }

  public onEvent<L extends K>(event: L, listener: (...payload: E[L]) => void): Disposable {
    this.emitter.on(event, listener);

    return {
      dispose: () => {
        this.emitter.off(event, listener);
      },
    };
  }
}
