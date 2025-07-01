/**
 * Interface representing a persistent key-value store.
 *
 * Provides asynchronous methods to update and retrieve values by key.
 */
export interface PersistentStore {
  update<V>(key: string, value: V | undefined): Promise<void>;
  get<V>(key: string): Promise<V | undefined>;
}
