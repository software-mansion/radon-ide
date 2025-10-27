import { Store, Element } from "../../../third-party/react-devtools/headless";

// removes the need for casting types, which is prone to mistakes
function getElementByID(id: number, store: Store): Element | null {
  return store.getElementByID(id) as unknown as Element | null;
}

function findTreeEntryPoint(store: Store, root?: Element): Element | null {
  const element = root ?? getElementByID(store.roots[0], store);

  if (!element) {
    return null;
  }

  const name = element.displayName;

  if (name && (name.startsWith("./") || name.startsWith("/"))) {
    return element;
  }

  const childrenIds = element.children ?? [];

  for (const childId of childrenIds) {
    const child = getElementByID(childId, store);

    if (!child) {
      throw new Error(`Component tree is corrupted. Element with ID ${childId} not found.`);
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
}

function prettyPrintComponentTree(store: Store, root?: Element, depth: number = 0): string {
  const element = root ?? findTreeEntryPoint(store);

  if (!element) {
    return `Component tree is corrupted. Could not find root of the component tree! Are you sure an application is running in the emulator?`;
  }

  const childrenIds = element.children;

  // `type = 2` means element is `Context.Provider`.
  // These are always wrapped by a component with a more descriptive name when user-made.
  const isContextProvider = element.type === 2;

  const childDepth = isContextProvider ? depth : depth + 1;
  let found: string = isContextProvider ? "" : "  ".repeat(depth) + `<${element.displayName}>\n`;

  for (const childId of childrenIds) {
    const child = getElementByID(childId, store);

    if (!child) {
      return `Component tree is corrupted. Element with ID ${childId} not found.`;
    }

    found += prettyPrintComponentTree(store, child, childDepth);
  }

  return found;
}

export default prettyPrintComponentTree;
