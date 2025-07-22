import _ from "lodash";
import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import { disposeAll } from "../utilities/disposables";

type EventMap<T> = {
  setState: Partial<T>;
};

export abstract class StateManager<T extends object> implements Disposable {
  abstract setState(partialState: Partial<T>): void;
  abstract getState(): T;

  protected eventEmitter: EventEmitter = new EventEmitter();
  protected disposables: Disposable[] = [];

  /**
   * Returns a DerivedStateManager or undefined based on the type of the value at the specified key.
   *
   * This method checks if the value under the provided key in the state object is an object.
   * If so, a new DerivedStateManager is created and returned for managing this part of the state.
   * Otherwise, if the value is not an object or is null/undefined, the method returns undefined, indicating that
   * no DerivedStateManager can be created for non-object types or nullish values.
   *
   * @param key - The key within the state object for which to derive a new state manager.
   *
   * @returns {DerivedStateManager<T[K], T> | undefined} A new DerivedStateManager if the value is an object,
   *                                                     otherwise undefined.
   */
  public getDerived<K extends keyof T>(
    key: K
  ): T[K] extends object ? DerivedStateManager<T[K], T> : undefined {
    const value = this.getState()[key];
    // Check if value is an object and not nullish
    if (value !== undefined && value !== null && typeof value === "object") {
      // Properly cast value to the specific type
      return new DerivedStateManager(this, key) as T[K] extends object
        ? DerivedStateManager<T[K], T>
        : undefined;
    } else {
      return undefined as T[K] extends object ? DerivedStateManager<T[K], T> : undefined;
    }
  }

  public on<K extends keyof EventMap<T>>(event: K, listener: (arg: EventMap<T>[K]) => void) {
    this.eventEmitter.on(event, listener);

    return new Disposable(() => {
      this.eventEmitter.off(event, listener);
    });
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}

export class RootStateManager<T extends object> extends StateManager<T> {
  private state: T;

  constructor(initialState: T) {
    super();
    this.state = initialState;
  }

  setState(partialState: Partial<T>): void {
    this.state = _.merge(this.state, partialState);
    this.eventEmitter.emit("setState", partialState);
  }

  getState(): T {
    return this.state;
  }
}

export class DerivedStateManager<T extends object, K extends object> extends StateManager<T> {
  constructor(
    private parent: StateManager<K>,
    private keyInParent: keyof K
  ) {
    super();
    this.disposables.push(
      parent.on("setState", (partialParentState: Partial<K>) => {
        const partialState = partialParentState[this.keyInParent] as T | undefined;
        if (!partialState) {
          return;
        }
        this.eventEmitter.emit("setState", partialState);
      })
    );
  }

  setState(partialValue: Partial<T>) {
    this.parent.setState({ [this.keyInParent]: partialValue } as Partial<K>);
  }

  getState() {
    return this.parent.getState()[this.keyInParent] as T;
  }
}
