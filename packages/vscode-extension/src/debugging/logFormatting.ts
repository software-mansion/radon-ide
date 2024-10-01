import util from "util";
import { CDPRemoteObject } from "./cdp";

function format(anything: unknown) {
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

export async function formatMessage(args: CDPRemoteObject[]): Promise<string> {
  return args
    .map((arg) => {
      switch (arg.type) {
        case "object":
          return format(arg.description || "[Object]");
        case "string":
        case "number":
        case "boolean":
          return arg.value;
        case "undefined":
          return format(undefined);
        case "function":
          return format(arg.description || "[Function]");
      }
    })
    .join(" ");
}
