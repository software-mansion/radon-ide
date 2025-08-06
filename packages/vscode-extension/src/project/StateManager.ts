import _ from "lodash";
import { Disposable, EventEmitter } from "vscode";
import { disposeAll } from "../utilities/disposables";
import { RecursivePartial } from "../common/State";
import { mergeAndCalculateChanges } from "../common/Merge";

export abstract class StateManager<T extends object> implements Disposable {
  static create<T extends object>(initialState: T): StateManager<T> {
    return new RootStateManager(initialState);
  }

  abstract setState(partialState: RecursivePartial<T>): void;
  abstract getState(): T;

  protected onSetStateEmitter = new EventEmitter<RecursivePartial<T>>();
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

  public onSetState(listener: (arg: RecursivePartial<T>) => void) {
    return this.onSetStateEmitter.event(listener);
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}

class RootStateManager<T extends object> extends StateManager<T> {
  private state: T;

  constructor(initialState: T) {
    super();
    this.state = initialState;
  }

  setState(partialState: RecursivePartial<T>): void {
    const [newState, changes] = mergeAndCalculateChanges(this.state, partialState);
    this.state = newState;
    this.onSetStateEmitter.fire(changes);
  }

  getState(): T {
    return this.state;
  }
}

class DerivedStateManager<T extends object, K extends object> extends StateManager<T> {
  constructor(
    private parent: StateManager<K>,
    private keyInParent: keyof K
  ) {
    super();
    this.disposables.push(
      parent.onSetState((partialParentState: RecursivePartial<K>) => {
        const partialState = partialParentState[this.keyInParent] as T | undefined;
        if (partialState === undefined) {
          return;
        }
        this.onSetStateEmitter.fire(partialState);
      })
    );
  }

  setState(partialValue: RecursivePartial<T>) {
    this.parent.setState({ [this.keyInParent]: partialValue } as RecursivePartial<K>);
  }

  getState() {
    return this.parent.getState()[this.keyInParent] as T;
  }
}
