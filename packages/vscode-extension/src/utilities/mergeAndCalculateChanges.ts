import { RecursivePartial } from "../common/State";

/**
 * Merges an existing state object with updates from a new partial state and calculates changes.
 *
 * @param {T} oldNode - The original state object.
 * @param {RecursivePartial<T>} newNode - A partial state object containing updates.
 *
 * @returns {[T, RecursivePartial<T>]} A tuple where the first element is the new state object post-merge, and the second
 * element is an object describing changes made.
 */
export function mergeAndCalculateChanges<T extends object>(
  oldNode: T,
  newNode: RecursivePartial<T>
): [T, RecursivePartial<T>] {
  const result: RecursivePartial<T> = {};
  const changes: RecursivePartial<T> = {};
  let wasChanged = false;

  const allKeys = [...Object.keys(oldNode), ...Object.keys(newNode)] as (keyof T)[];

  for (const key of allKeys) {
    if (newNode[key] === undefined || newNode[key] === null) {
      result[key] = oldNode[key];
      continue;
    }
    if (typeof oldNode[key] === "object" && oldNode[key] !== null && !Array.isArray(oldNode[key])) {
      const [newChild, childChanges] = mergeAndCalculateChanges(oldNode[key], newNode[key]);

      if (oldNode[key] !== newChild) {
        wasChanged = true;
        changes[key] = childChanges;
      }
      result[key] = newChild;
      continue;
    }
    if (oldNode[key] === newNode[key]) {
      result[key] = oldNode[key];
    } else {
      wasChanged = true;
      result[key] = newNode[key];
      changes[key] = newNode[key];
    }
  }

  if (wasChanged) {
    return [result, changes] as [T, Partial<T>];
  }
  return [oldNode, {}];
}
