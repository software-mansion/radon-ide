import { RecursivePartial } from "../common/State";

/**
 * Merges an existing state object with updates from a new partial state.
 *
 * @param {T} oldNode - The original state object.
 * @param {RecursivePartial<T>} newNode - A partial state object containing updates.
 *
 * @returns {T} The new state object post-merge.
 */
export function merge<T extends { [P in keyof T]: T[P] }>(
  oldNode: T,
  newNode: RecursivePartial<T>
): T {
  const result: RecursivePartial<T> = {};
  let wasChanged = false;

  const allKeys = [...Object.keys(oldNode), ...Object.keys(newNode)] as (keyof T)[];

  for (const key of allKeys) {
    if (newNode[key] === undefined || newNode[key] === null) {
      result[key] = oldNode[key];
      continue;
    }
    if (typeof oldNode[key] === "object" && oldNode[key] !== null && !Array.isArray(oldNode[key])) {
      const newChild = merge(oldNode[key], newNode[key]);

      if (oldNode[key] !== newChild) {
        wasChanged = true;
      }
      result[key] = newChild;
      continue;
    }
    if (oldNode[key] === newNode[key]) {
      result[key] = oldNode[key];
    } else {
      wasChanged = true;
      result[key] = newNode[key];
    }
  }

  if (wasChanged) {
    return result as T;
  }
  return oldNode;
}
