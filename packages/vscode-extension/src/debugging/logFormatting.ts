import util from "util";
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

export async function formatMessage(args: [CDPRemoteObject]): Promise<string> {
  let result: string = "";
  const mappedArgs = await Promise.all(
    args.map((arg, index) => {
      switch (arg.type) {
        case "object":
          return format(arg.description || "[Object]");
        case "string":
        case "number":
        case "boolean":
          return arg.value;
        case "undefined":
          return format(arg.value);
        case "function":
          return format(arg.description || "[Function]");
      }
    })
  );

  mappedArgs.forEach((arg) => {
    result += `${arg} `;
  });

  return result;
}
