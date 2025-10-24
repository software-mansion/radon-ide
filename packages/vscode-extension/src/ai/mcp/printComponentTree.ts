import { Store, Element } from "../../../third-party/react-devtools/headless";

const _isExpoRouterInTree = (store: Store, root?: Element): boolean => {
  const element = root ?? (store.getElementByID(store.roots[0]) as unknown as Element);

  if (element.displayName === "ExpoRoot") {
    return true;
  }

  return element.children.some((childId) => {
    const child = store.getElementByID(childId) as unknown as Element | null;

    if (!child) {
      return false;
    }

    return _isExpoRouterInTree(store, child);
  });
};

const findTreeEntryPoint = (store: Store, root?: Element): Element | null => {
  const element = root ?? (store.getElementByID(store.roots[0]) as unknown as Element);

  const name = element.displayName;

  if (name && (name.startsWith("./") || name.startsWith("/"))) {
    return element;
  }

  const childrenIds = element.children;

  for (const childId of childrenIds) {
    const child = store.getElementByID(childId) as unknown as Element | null;

    if (!child) {
      throw new Error("Component tree is corrupted. Element with ID ${childId} not found.");
    }

    const entryPoint = findTreeEntryPoint(store, child);

    if (entryPoint) {
      return entryPoint;
    }
  }

  if (!root) {
    // Return self if self is HOC and no other entry points found.
    return element;
  }

  return null;
};

const prettyPrintComponentTree = (store: Store, root?: Element, depth: number = 0): string => {
  const element = root ?? (findTreeEntryPoint(store) as Element);

  const childrenIds = element.children;

  // `type = 2` means element is `Context.Provider`.
  // These are always wrapped with a more descriptive name when user-made.
  const isContextProvider = element.type === 2;

  const childDepth = isContextProvider ? depth : depth + 1;
  let found: string = isContextProvider
    ? ""
    : "  ".repeat(depth) + `<${element.displayName} type=${element.type}>\n`;

  for (const childId of childrenIds) {
    const child = store.getElementByID(childId) as unknown as Element;

    if (!child) {
      return `Component tree is corrupted. Element with ID ${childId} not found.`;
    }

    found += prettyPrintComponentTree(store, child, childDepth);
  }

  return found;
};

export default prettyPrintComponentTree;
