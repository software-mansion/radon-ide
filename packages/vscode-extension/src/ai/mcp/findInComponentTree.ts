import { InspectElementFullData } from "react-devtools-inline";
import { Store } from "../../../third-party/react-devtools/headless";
import { DevtoolsElement } from "./models";
import { getDevtoolsElementByID } from "./utils";
import { DeviceSession } from "../../project/deviceSession";

type QueryProps = { children?: string; testID?: string };

function extractQueryProps(payload: InspectElementFullData): QueryProps {
  return payload.value?.props?.data as QueryProps;
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
    const props = extractQueryProps(details);
    if (props.children?.includes(query) || props.testID?.includes(query)) {
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
