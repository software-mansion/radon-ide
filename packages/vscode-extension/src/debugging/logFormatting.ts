import util from "util";
import { DebugAdapter } from "./DebugAdapter";
import { CDPSubType, CDPValueType, FormattedLog } from "./cdp";
import { Source } from "@vscode/debugadapter";

export interface CDPRemoteObject {
  type: CDPValueType;
  subtype?: CDPSubType;
  className?: string;
  value?: any;
  objectId?: number;
  description?: string;
}

function format(anything: any) {
  const formatted = util.inspect(anything, {
    showHidden: false,
    depth: Infinity,
    colors: false,
    maxArrayLength: 20,
    compact: true,
  });
  if (typeof anything === "string") {
    // remote single quotes
    return formatted.slice(1, -1);
  }
  return formatted;
}

async function retrieveObject(
  objectId: any,
  debugadapter: DebugAdapter,
  processedObjects: Set<any>,
  prefix?: string
): Promise<FormattedLog> {
  if (processedObjects.has(objectId)) {
    return {
      label: (prefix ? prefix : "") + "{}",
      children: [],
    };
  }
  const properties = await debugadapter.sendCDPMessage("Runtime.getProperties", {
    objectId: objectId,
    ownProperties: true,
  });
  const res = {
    label: (prefix ? prefix : "") + "{...}",
    children: new Array(),
  };
  await Promise.all(
    properties.result.map(async (prop: any) => {
      if (prop.name === "__proto__") {
        // do not include __proto__ in the formatted output
        return;
      }
      switch (prop.value.type) {
        case "number":
        case "string":
        case "boolean":
          res.children.push({
            label: prop.name + ": " + prop.value.value,
            children: "",
          });
          break;
        case "object":
          res.children.push(
            await retrieveObject(
              prop.value.objectId,
              debugadapter,
              processedObjects.add(objectId),
              prop.name + ": "
            )
          );
          break;
        case "function":
          res.children.push({
            label: prop.name + ": " + (prop.description || function () {}),
            children: "",
          });
          break;
      }
    })
  );
  return res;
}

export async function formatMessage(
  args: [CDPRemoteObject],
  debugadapter: DebugAdapter
): Promise<FormattedLog> {
  const result: FormattedLog = {
    label: "",
  };

  const mappedArgs = await Promise.all(
    args.map(async (arg, index) => {
      let res: FormattedLog = {
        label: "",
      };
      switch (arg.type) {
        case "object":
          res = await retrieveObject(arg.objectId, debugadapter, new Set());
          break;
        case "string":
        case "number":
        case "boolean":
          res.label = arg.value;
          break;
        case "undefined":
          res.label = format(arg.value);
          break;
        case "function":
          res.label = format(arg.description || "[Function]");
          break;
      }
      return res;
    })
  );

  result.label = mappedArgs
    .map((item) => {
      return item?.label;
    })
    .join(" ")
    .slice(0, 79);

  result.children = mappedArgs;

  return result;
}
