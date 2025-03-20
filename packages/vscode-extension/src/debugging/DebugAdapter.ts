import { DebugSession as DebugAdapterSession, OutputEvent, Source } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { DebugSource } from "./DebugSession";

export type CDPConfiguration = {
  websocketAddress: string;
  expoPreludeLineCount: number;
  isUsingNewDebugger: boolean;
  metroWatchFolders: string[];
};

export function typeToCategory(type: string) {
  switch (type) {
    case "warning":
    case "error":
      return "stderr";
    default:
      return "stdout";
  }
}

export class DebugAdapter extends DebugAdapterSession {
  constructor() {
    super();
  }

  logCustomMessage(message: string, category: string, source?: DebugSource) {
    const output = new OutputEvent(message, typeToCategory(category));
    if (source) {
      output.body = {
        output: message,
        //@ts-ignore source, line, column and group are valid fields
        source: new Source(source.filename, source.filename),
        line: source.line1based,
        column: source.column0based,
      };
    }
    this.sendEvent(output);
  }

  protected async customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any,
    request?: DebugProtocol.Request | undefined
  ) {
    switch (command) {
      case "RNIDE_log_message":
        this.logCustomMessage(args.message, args.type, args.source);
        break;
    }
    this.sendResponse(response);
  }
}
