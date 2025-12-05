import { InspectElementFullData } from "react-devtools-inline";
import { Store } from "../../../third-party/react-devtools/headless";
import { DevtoolsElement } from "./models";
import { getDevtoolsElementByID } from "./utils";
import { DeviceSession } from "../../project/deviceSession";

function extractTextContent(payload: InspectElementFullData): string {
  // TODO: `testID` should be available alongside `children`
  const text = (payload.value?.props?.data as { children?: unknown })?.children;
  return typeof text === "string" ? text : "";
}

async function findInComponentTree(
  session: DeviceSession,
  store: Store,
  element: DevtoolsElement,
  query: string
): Promise<DevtoolsElement | null> {
  // TODO: Document that `key` is checked as well
  if (element.key?.toString().includes(query)) {
    return element;
  }

  const details = await session.inspectElementById(element.id);

  if (details !== undefined) {
    const text = extractTextContent(details);
    if (text.includes(query)) {
      return element;
    }
  }

  // TODO: Check testID

  // TODO: What if element.children is iterable but not an array??? Doesn't this throw
  for (const childId of element.children) {
    const child = getDevtoolsElementByID(childId, store);

    if (!child) {
      throw new Error(`Component tree is corrupted. Element with ID ${childId} not found.`);
    }

    const entryPoint = findInComponentTree(session, store, child, query);

    if (entryPoint) {
      return entryPoint;
    }
  }

  return null;
}

export default findInComponentTree;
