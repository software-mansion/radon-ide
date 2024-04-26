import util, { InspectOptions } from "util";
import { DebugAdapter } from "./DebugAdapter";
import { CDPSubType, CDPValueType } from "./cdp";

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
    depth: null,
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

async function retrieveObject(objectId: any, debugadapter: DebugAdapter) {
  const properties = await debugadapter.sendCDPMessage("Runtime.getProperties", {
    objectId: objectId,
    ownProperties: true,
  });
  const obj: any = {};
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
          obj[prop.name] = prop.value.value;
          break;
        case "object":
          obj[prop.name] = (await retrieveObject(prop.value.objectId, debugadapter)) || {};
          break;
        case "function":
          obj[prop.name] = prop.description || function () {};
          break;
      }
    })
  );
  return obj;
}

export async function formatMessage(args: [CDPRemoteObject], debugadapter: DebugAdapter) {
  const mappedArgs = await Promise.all(
    args.map(async (arg) => {
      switch (arg.type) {
        case "object":
          return format(await retrieveObject(arg.objectId, debugadapter));
        case "string":
        case "number":
        case "boolean":
        case "undefined":
          return format(arg.value);
        case "function":
          return format(arg.description || "[Function]");
      }
    })
  );

  return mappedArgs.join(" ");
}
