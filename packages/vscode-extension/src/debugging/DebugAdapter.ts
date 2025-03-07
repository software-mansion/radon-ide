import { debug, DebugConsoleMode, DebugSession } from "vscode";
import { DebugSession as DebugAdapterSession, OutputEvent, Source } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Disposable } from "vscode";
import { DebugSource } from "./DebugSession";

export type CDPConfiguration = {
  websocketAddress: string;
  expoPreludeLineCount: number;
  sourceMapAliases: [string, string][];
  breakpointsAreRemovedOnContextCleared: boolean;
};

const JS_DEBUGGER_TYPE = "com.swmansion.js-debugger";

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
  private cdpDebugSession: DebugSession | null = null;

  constructor(private vscDebugSession: DebugSession) {
    super();
  }

  private async connectJSDebugger(cdpConfiguration: CDPConfiguration) {
    let didStartHandler: Disposable | null = debug.onDidStartDebugSession((session) => {
      if (session.type === JS_DEBUGGER_TYPE) {
        this.cdpDebugSession = session;
        didStartHandler?.dispose();
        didStartHandler = null;
      }
    });

    try {
      await debug.startDebugging(
        undefined,
        {
          type: JS_DEBUGGER_TYPE,
          name: "React Native JS Debugger",
          request: "attach",
          ...cdpConfiguration,
        },
        {
          parentSession: this.vscDebugSession,
          suppressDebugStatusbar: true,
          suppressDebugView: true,
          suppressDebugToolbar: true,
          suppressSaveBeforeStart: true,
          consoleMode: DebugConsoleMode.MergeWithParent,
          compact: true,
        }
      );

      console.assert(this.cdpDebugSession, "CDP Debug session should be set once it's started");
    } finally {
      didStartHandler?.dispose();
    }
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
      case "RNIDE_connect_cdp_debugger":
        if (this.cdpDebugSession) {
          debug.stopDebugging(this.cdpDebugSession);
          this.cdpDebugSession = null;
        }
        await this.connectJSDebugger(args);
        break;
      case "RNIDE_log_message":
        this.logCustomMessage(args.message, args.type, args.source);
        break;
      default:
        // NOTE: forward unhandled custom requests to the JS Debug session
        await this.cdpDebugSession?.customRequest(command, args);
        break;
    }
    this.sendResponse(response);
  }
}
