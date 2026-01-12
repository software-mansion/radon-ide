import { Disposable } from "vscode";

type Listener<T> = (value: T) => void;

/**
 * A minimal single-variable state.
 * This class prevents pollution of the global state,
 * when a simple state is necessary in a local, not global context.
 */
export class Observable<T> {
  private value;
  private listeners: Listener<T>[];

  constructor(initialValue: T) {
    this.value = initialValue;
    this.listeners = [];
  }

  public onUpdate(cb: Listener<T>): Disposable {
    this.listeners.push(cb);
    return new Disposable(() => {
      let index = this.listeners.indexOf(cb);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    });
  }

  public get() {
    return this.value;
  }

  public set(value: T) {
    this.value = value;
    this.listeners.forEach((cb) => cb(value));
  }
}
