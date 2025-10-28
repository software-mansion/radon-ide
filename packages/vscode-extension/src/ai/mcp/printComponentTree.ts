import { Store } from "../../../third-party/react-devtools/headless";
import { DevtoolsElement } from "./models";

// This util removes the need for type-casting on every `store.getElementByID` call
function getElementByID(id: number, store: Store): DevtoolsElement | null {
  return store.getElementByID(id) as unknown as DevtoolsElement | null;
}

function findTreeEntryPoint(store: Store, root?: DevtoolsElement): DevtoolsElement | null {
  const element = root ?? getElementByID(store.roots[0], store);

  if (!element) {
    return null;
  }

  const name = element.displayName;

  // User-defined `expo-router` paths start with `./` or `/`. First one found serves as our entry-point if present.
  if (name && (name.startsWith("./") || name.startsWith("/"))) {
    return element;
  }

  for (const childId of element.children) {
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

function hasHocDescriptors(element: DevtoolsElement): element is DevtoolsElement & {
  hocDisplayNames: NonNullable<DevtoolsElement["hocDisplayNames"]>;
} {
  return (element?.hocDisplayNames?.length ?? 0) > 0;
}

function printComponentTree(store: Store, root?: DevtoolsElement, depth: number = 0): string {
  const element = root ?? findTreeEntryPoint(store);

  if (!element) {
    return `Component tree is corrupted. Could not find root of the component tree! Are you sure an application is running in the emulator?`;
  }

  // `type = 2` means element is `Context.Provider`.
  // These are always wrapped by a component with a more descriptive name when user-made.
  const isContextProvider = element.type === 2;

  const childDepth = isContextProvider ? depth : depth + 1;

  const hocDescriptors = hasHocDescriptors(element)
    ? ` [${element.hocDisplayNames.join(", ")}]`
    : "";

  const componentRepr: string = !isContextProvider
    ? "  ".repeat(depth) + `<${element.displayName}>${hocDescriptors}\n`
    : "";

  const childrenRepr = element.children.map((childId) => {
    const child = getElementByID(childId, store);

    if (!child) {
      return `Component tree is corrupted. Element with ID ${childId} not found.`;
    }

    return printComponentTree(store, child, childDepth);
  });

  return componentRepr + childrenRepr.join("");
}

export default printComponentTree;
