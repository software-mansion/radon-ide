import util, { InspectOptions } from "util";
import { DebugAdapter } from "./DebugAdapter";
import { CDPSubType, CDPValueType, FormmatedLog } from "./cdp";
import { Logger } from "../Logger";
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
    depth: 3,
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
  category: "stderr" | "stdout",
  depth: number
): Promise<FormmatedLog> {
  Logger.debug("Frytki", "filip");
  if (depth > 3) {
    return {
      unindented: "{}",
      indented: [],
      category,
    };
  }
  Logger.debug("Frytki", "magda");
  const properties = await debugadapter.sendCDPMessage("Runtime.getProperties", {
    objectId: objectId,
    ownProperties: true,
  });
  const res = {
    unindented: "filip",
    indented: new Array(),
    category,
  };
  const obj: any = {};
  await Promise.all(
    properties.result.map(async (prop: any) => {
      if (prop.name === "__proto__") {
        // do not include __proto__ in the formatted output
        return;
      }
      switch (prop.value.type) {
        case "number":
          Logger.debug("Frytki", "kuba");
          Logger.debug("Frytki", res.indented);
          obj[prop.name] = prop.value;
          res.indented.push({
            unindented: prop.name + ": " + prop.value,
            indented: "",
            category,
          });
          Logger.debug("Frytki", res.indented);
          break;
        case "string":
          obj[prop.name] = prop.value;
          res.indented.push({
            unindented: prop.name + ": " + prop.value,
            indented: "",
            category,
          });
          break;
        case "boolean":
          obj[prop.name] = prop.value;
          res.indented.push({
            unindented: prop.name + ": " + prop.value,
            indented: "",
            category,
          });
          break;
        case "object":
          obj[prop.name] =
            (await retrieveObject(prop.value.objectId, debugadapter, category, depth + 1)) || {};
          res.indented.push({
            unindented: prop.name + ": {...}",
            indented: [
              await retrieveObject(prop.value.objectId, debugadapter, category, depth + 1),
            ],
            category,
          });
          break;
        case "function":
          obj[prop.name] = prop.description || function () {};
          res.indented.push({
            unindented: prop.name + ": " + (prop.description || function () {}),
            indented: "",
            category,
          });
          break;
      }
    })
  );

  return res;
}

export async function formatMessage(
  args: [CDPRemoteObject],
  debugadapter: DebugAdapter,
  category: "stderr" | "stdout",
  line?: number,
  column?: number,
  sourceURL?: string
): Promise<FormmatedLog> {
  const result: FormmatedLog = {
    unindented: "",
    line,
    column,
    category,
    source: sourceURL ? new Source(sourceURL, sourceURL) : undefined,
  };

  const mappedArgs = await Promise.all(
    args.map(async (arg, index) => {
      let res = {
        prefix: `arg${index}: `,
        unindented: "",
        category,
      };
      switch (arg.type) {
        case "object":
          Logger.debug("Frytki", "uifwhweuhf");
          res = await retrieveObject(arg.objectId, debugadapter, category, 0);
          Logger.debug("Frytki dgfusdgehfiuewf kuba", res);
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

  const stringResult = mappedArgs
    .map((item) => {
      return item?.unindented;
    })
    .join(" ");

  if (stringResult.length > 30) {
    result.unindented = stringResult.slice(0, 79) + "...";
    result.indented = mappedArgs;
  } else {
    result.unindented = stringResult;
  }

  return result;
}
