import { PersistentStore } from "../../common/PersistentStore";
import { makeProxy } from "./rpc";

/**
 * A proxy instance of the persistent store for workspace-level data.
 *
 * This store provides access to persistent data scoped to the current workspace,
 * allowing for reading and writing of settings or state that should be retained
 * across sessions within the same workspace.
 *
 * @see PersistentStore
 * @see makeProxy
 */
export const workspaceStore = makeProxy<PersistentStore>("WorkspaceStore");
