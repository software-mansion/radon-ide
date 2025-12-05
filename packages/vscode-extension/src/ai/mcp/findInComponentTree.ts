import { Store } from "../../../third-party/react-devtools/headless";
import { DevtoolsElement } from "./models";
import { getDevtoolsElementByID } from "./utils";

function findInComponentTree(
  store: Store,
  element: DevtoolsElement,
  query: string
): DevtoolsElement | null {
  // TODO: Should be limit our search to just the app user-root, or is there value in searching all?

  // TODO: Document that `key` is checked as well
  if (element.key?.toString().includes(query)) {
    return element;
  }

  // TODO: Ensure `children` typeof `string`
  if (element.children?.toString().includes(query)) {
    return element;
  }

  // TODO: Check testID

  // TODO: What if element.children is iterable but not an array??? Doesn't this throw
  for (const childId of element.children) {
    const child = getDevtoolsElementByID(childId, store);

    if (!child) {
      throw new Error(`Component tree is corrupted. Element with ID ${childId} not found.`);
    }

    const entryPoint = findInComponentTree(store, child, query);

    if (entryPoint) {
      return entryPoint;
    }
  }

  return null;
}

export default findInComponentTree;
