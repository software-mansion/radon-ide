import { Memento } from "vscode";
import { PersistentStore } from "../common/PersistentStore";

/**
 * A wrapper class for VS Code's {@link Memento} that implements the {@link PersistentStore} interface.
 * Provides asynchronous methods to persist and retrieve data using a key-value store.
 */
export class MementoStore implements PersistentStore {
  constructor(private memento: Memento) {}

  async update<V>(key: string, value: V | undefined): Promise<void> {
    this.memento.update(key, value);
  }

  async get<V>(key: string): Promise<V | undefined> {
    return this.memento.get<V>(key);
  }
}
