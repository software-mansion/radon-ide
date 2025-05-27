import { isEqual } from "lodash";

export function getChanges<T extends Record<string, any>>(oldObj: T, newObj: T): Partial<T> {
  const changes: Partial<T> = {};

  for (const key in newObj) {
    if (!isEqual(oldObj[key], newObj[key])) {
      changes[key] = newObj[key];
    }
  }

  return changes;
}
