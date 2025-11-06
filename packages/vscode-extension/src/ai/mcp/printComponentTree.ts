import { InspectElementFullData } from "react-devtools-inline";
import { workspace } from "vscode";
import { Store } from "../../../third-party/react-devtools/headless";
import { DeviceSession } from "../../project/deviceSession";
import { DevtoolsElement } from "./models";
import { isAppSourceFile } from "../../utilities/isAppSourceFile";
import { getDevtoolsElementByID } from "./utils";

// This methods finds and returns the `AppWrapper` if said component exists
function findTreeEntryPoint(store: Store, element: DevtoolsElement): DevtoolsElement | null {
  if (element.key === "__RNIDE_APP_WRAPPER") {
    return element;
  }

  for (const childId of element.children) {
    const child = getDevtoolsElementByID(childId, store);

    if (!child) {
      throw new Error(`Component tree is corrupted. Element with ID ${childId} not found.`);
    }

    const entryPoint = findTreeEntryPoint(store, child);

    if (entryPoint) {
      return entryPoint;
    }
  }

  return null;
}

function hasHocDescriptors(element: DevtoolsElement): element is DevtoolsElement & {
  hocDisplayNames: NonNullable<DevtoolsElement["hocDisplayNames"]>;
} {
  return !!element?.hocDisplayNames?.length;
}

function printHocDescriptors(element: DevtoolsElement): string {
  return hasHocDescriptors(element) ? `\u0020[${element.hocDisplayNames.join(", ")}]` : "";
}

function printTextContent(indent: string, payload: InspectElementFullData): string {
  const text = (payload.value?.props?.data as { children?: unknown })?.children;
  return typeof text === "string" ? `${indent}\u0020\u0020${text}\n` : "";
}

async function representElement(
  element: DevtoolsElement,
  details: InspectElementFullData,
  depth: number,
  isUserMade: boolean,
  hasChildren: boolean
): Promise<{ open: string; close: string }> {
  const indent = "\u0020".repeat(depth * 2);
  const hocDescriptors = printHocDescriptors(element);
  const textContent = !isUserMade ? printTextContent(indent, details) : "";
  const source = details.value.source;
  const shouldPrintSource = source && isAppSourceFile(source.fileName);
  const relativePath = shouldPrintSource ? workspace.asRelativePath(source.fileName, false) : "";
  const sourceDescription = shouldPrintSource ? `\u0020(${relativePath}:${source.lineNumber})` : "";
  const cleanName = element.displayName && element.displayName.replaceAll(/(\.*\/+)/g, "");
  const shouldRenderClose = hasChildren || textContent !== "";
  return {
    open: `${indent}<${cleanName}${shouldRenderClose ? "" : "\u0020/"}>${hocDescriptors}${sourceDescription}\n${textContent}`,
    close: shouldRenderClose ? `${indent}</${cleanName}>\n` : "",
  };
}

async function printComponentTree(
  session: DeviceSession,
  root: DevtoolsElement,
  userLogicalComponentIDs: number[] = [],
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

  const element = findTreeEntryPoint(store, root) ?? root;
  const details = await session.inspectElementById(element.id);

  const isComponentUserMade = isAppSourceFile(details?.value.source?.fileName ?? "");
  const isComponentUserOwned = userLogicalComponentIDs.includes(element.ownerID);
  const isComponentUserRelated = isComponentUserMade || isComponentUserOwned;

  if (isComponentUserMade) {
    userLogicalComponentIDs.push(element.id);
  }

  const skipRendering = !details || element.displayName === null || !isComponentUserRelated;
  const childDepth = depth + (skipRendering ? 0 : 1);

  const childrenStrings = await Promise.all(
    element.children.map((childId) => {
      const child = getDevtoolsElementByID(childId, store);

      if (!child) {
        throw new Error(`Component tree is corrupted. Element with ID ${childId} not found.`);
      }

      return printComponentTree(session, child, userLogicalComponentIDs, childDepth);
    })
  );

  const childrenRepr = childrenStrings.join("");

  const componentRepr = !skipRendering
    ? await representElement(element, details, depth, isComponentUserMade, childrenRepr !== "")
    : { open: "", close: "" };

  // `skipRendering` affects the current component, but doesn't affect children
  return componentRepr.open + childrenRepr + componentRepr.close;
}

export default printComponentTree;
