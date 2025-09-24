import { RecursivePartial, REMOVE } from "../common/State";

/**
 * Merges an existing state object with updates from a new partial state and calculates changes.
 *
 * @param {T} oldNode - The original state object.
 * @param {RecursivePartial<T>} newNode - A partial state object containing updates.
 *
 * @returns {[T, RecursivePartial<T>]} A tuple where the first element is the new state object post-merge, and the second
 * element is an object describing changes made.
 */
export function mergeAndCalculateChanges<T extends { [P in keyof T]: T[P] }>(
  oldNode: T,
  newNode: RecursivePartial<T>
): [T, RecursivePartial<T>] {
  const result: RecursivePartial<T> = {};
  const changes: RecursivePartial<T> = {};
  let wasChanged = false;

  const allKeys = [...Object.keys(oldNode), ...Object.keys(newNode)] as (keyof T)[];

  for (const key of allKeys) {
    if (newNode[key] === REMOVE) {
      changes[key] = REMOVE as (typeof changes)[typeof key];
      wasChanged = true;
      continue;
    }
    if (newNode[key] === null) {
      result[key] = newNode[key];
      changes[key] = newNode[key];
      wasChanged = true;
      continue;
    }
    if (newNode[key] === undefined) {
      result[key] = oldNode[key];
      continue;
    }
    if (typeof oldNode[key] === "object" && oldNode[key] !== null && !Array.isArray(oldNode[key])) {
      const [newChild, childChanges] = mergeAndCalculateChanges(oldNode[key], newNode[key]);

      if (oldNode[key] !== newChild) {
        wasChanged = true;
        changes[key] = childChanges as (typeof changes)[typeof key];
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
    return [result, changes] as [T, RecursivePartial<T>];
  }
  return [oldNode, {}];
}

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
  const [result] = mergeAndCalculateChanges(oldNode, newNode);
  return result;
}

/**
 * Transforms a RecursivePartial object into an array of RecursivePartial objects,
 * each containing only a single leaf node from the original object.
 *
 * @param partial - A RecursivePartial object to be split into single-leaf objects.
 * @returns An array of RecursivePartial objects, each representing a single leaf node.
 */
export function splitRecursivePartialToSingleLeafs<T>(
  partial: RecursivePartial<T>
): Array<RecursivePartial<T>> {
  const result: any = [];

  function traverse(obj: any, pathKeys: any = []) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        traverse(value, [...pathKeys, key]);
      } else {
        const leafObject = {};
        setNestedValue(leafObject, [...pathKeys, key], value);
        result.push(leafObject);
      }
    }
  }

  function setNestedValue(obj: any, pathKeys: any, value: any) {
    let current = obj;
    for (let i = 0; i < pathKeys.length - 1; i++) {
      if (!current[pathKeys[i]]) {
        current[pathKeys[i]] = {};
      }
      current = current[pathKeys[i]];
    }
    current[pathKeys[pathKeys.length - 1]] = value;
  }

  traverse(partial);
  return result;
}
