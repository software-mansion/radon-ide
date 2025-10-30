import { InspectedElementPayload, InspectElementFullData } from "react-devtools-inline";
import { Store } from "../../../third-party/react-devtools/headless";
import { DeviceSession } from "../../project/deviceSession";
import { DevtoolsElement } from "./models";

// This util removes the need for type-casting on every `store.getElementByID` call
function getElementByID(id: number, store: Store): DevtoolsElement | null {
  return store.getElementByID(id) as unknown as DevtoolsElement | null;
}

function findTreeEntryPoint(store: Store, root?: DevtoolsElement): DevtoolsElement | null {
  const isTreeRoot = root === undefined;
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

  if (isTreeRoot) {
    return element;
  }

  return null;
}

function hasHocDescriptors(element: DevtoolsElement): element is DevtoolsElement & {
  hocDisplayNames: NonNullable<DevtoolsElement["hocDisplayNames"]>;
} {
  return (element?.hocDisplayNames?.length ?? 0) > 0;
}

function isFullData(payload?: InspectedElementPayload): payload is InspectElementFullData {
  return payload?.type === "full-data";
}

function printHocDescriptors(element: DevtoolsElement): string | null {
  return hasHocDescriptors(element) ? `\u0020[${element.hocDisplayNames.join(", ")}]` : "";
}

function printTextContent(indent: string, payload?: InspectedElementPayload): string {
  if (isFullData(payload)) {
    const text = (payload.value?.props?.data as { children?: unknown })?.children;
    return typeof text === "string" ? `${indent}\u0020\u0020${text}\n` : "";
  }
  return "";
}

async function representElement(
  element: DevtoolsElement,
  depth: number,
  session: DeviceSession
): Promise<string> {
  const details = await session.inspectElementById(element.id);

  const hocDescriptors = printHocDescriptors(element);

  const indent = "\u0020".repeat(depth * 2);

  const textContent = printTextContent(indent, details);

  return `${indent}<${element.displayName}>${hocDescriptors}\n${textContent}`;
}

async function printComponentTree(
  session: DeviceSession,
  root?: DevtoolsElement,
  depth: number = 0
): Promise<string> {
  const store = session.devtoolsStore;

  if (!store) {
    throw Error(
      "Could not extract a component tree from the app, the devtools are not accessible!\n" +
        "Ensure an application is running on the development device!\n" +
        "Please launch the app on the Radon IDE emulator before proceeding."
    );
  }

  const element = root ?? findTreeEntryPoint(store);

  if (!element) {
    throw Error(
      `Component tree is corrupted. Could not find root of the component tree! Are you sure an application is running in the emulator?`
    );
  }

  // `type = 2` means element is `Context.Provider`.
  // These are always wrapped by a component with a more descriptive name when user-made.
  const skipRendering = element.type === 2 || element.displayName === null;

  const componentRepr = !skipRendering ? await representElement(element, depth, session) : "";

  const childDepth = depth + (skipRendering ? 0 : 1);

  const childrenRepr = await Promise.all(
    element.children.map((childId) => {
      const child = getElementByID(childId, store);

      if (!child) {
        return `Component tree is corrupted. Element with ID ${childId} not found.`;
      }

      return printComponentTree(session, child, childDepth);
    })
  );

  return componentRepr + childrenRepr.join("");
}

export default printComponentTree;
