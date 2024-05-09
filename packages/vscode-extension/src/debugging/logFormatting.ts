import util from "util";
import { DebugAdapter } from "./DebugAdapter";
import { CDPSubType, CDPValueType, FormmatedLog } from "./cdp";
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
): Promise<FormmatedLog> {
  if (processedObjects.has(objectId)) {
    return {
      prefix,
      unindented: "{}",
      indented: [],
    };
  }
  const properties = await debugadapter.sendCDPMessage("Runtime.getProperties", {
    objectId: objectId,
    ownProperties: true,
  });
  const res = {
    prefix,
    unindented: "{...}",
    indented: new Array(),
  };
  await Promise.all(
    properties.result.map(async (prop: any) => {
      if (prop.name === "__proto__") {
        // do not include __proto__ in the formatted output
        return;
      }
      switch (prop.value.type) {
        case "number":
          res.indented.push({
            prefix: prop.name + ": ",
            unindented: prop.value.value,
            indented: "",
          });
          break;
        case "string":
          res.indented.push({
            prefix: prop.name + ": ",
            unindented: prop.value.value,
            indented: "",
          });
          break;
        case "boolean":
          res.indented.push({
            prefix: prop.name + ": ",
            unindented: prop.value.value,
            indented: "",
          });
          break;
        case "object":
          res.indented.push(
            await retrieveObject(
              prop.value.objectId,
              debugadapter,
              processedObjects.add(objectId),
              prop.name + ": "
            )
          );
          break;
        case "function":
          res.indented.push({
            unindented: prop.name + ": " + (prop.description || function () {}),
            indented: "",
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
): Promise<FormmatedLog> {
  const result: FormmatedLog = {
    unindented: "",
  };

  const mappedArgs = await Promise.all(
    args.map(async (arg, index) => {
      let res: FormmatedLog = {
        prefix: `arg${index}: `,
        unindented: "",
      };
      switch (arg.type) {
        case "object":
          res = await retrieveObject(arg.objectId, debugadapter, new Set(), `arg${index}: `);
          break;
        case "string":
          res.unindented = arg.value;
          break;
        case "number":
          res.unindented = arg.value;
          break;
        case "boolean":
          res.unindented = arg.value;
          break;
        case "undefined":
          res.unindented = format(arg.value);
          break;
        case "function":
          res.unindented = format(arg.description || "[Function]");
          break;
      }
      return res;
    })
  );

  result.unindented = mappedArgs
    .map((item) => {
      return item?.unindented;
    })
    .join(" ")
    .slice(0, 79);

  result.indented = mappedArgs;

  return result;
}
