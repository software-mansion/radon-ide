import { Store, Element } from "../../../third-party/react-devtools/headless";

const prettyPrintComponentTree = (store: Store, root?: Element, depth: number = 0): string => {
  const element = root ?? (store.getElementByID(store.roots[0]) as unknown as Element);

  const childrenIds = element.children;

  let found: string = "  ".repeat(depth) + `<${element.displayName}>\n`;

  for (const childId of childrenIds) {
    const child = store.getElementByID(childId) as unknown as Element;

    if (!child) {
      return "NOT FOUND";
    }

    found += prettyPrintComponentTree(store, child, depth + 1);
  }

  return found;
};

export default prettyPrintComponentTree;
