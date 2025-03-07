import path from "path";
import { debug, DebugConsoleMode, DebugSession } from "vscode";
import { DebugSession as DebugAdapterSession, OutputEvent, Source } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Disposable } from "vscode";
import { DebugSource } from "./DebugSession";

export type CDPConfiguration = {
  websocketAddress: string;
  expoPreludeLineCount: number;
  isUsingNewDebugger: boolean;
  metroWatchFolders: string[];
};

const OLD_JS_DEBUGGER_TYPE = "com.swmansion.js-debugger";
const PROXY_JS_DEBUGGER_TYPE = "com.swmansion.proxy-debugger";

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
    const { websocketAddress, expoPreludeLineCount, isUsingNewDebugger, metroWatchFolders } =
      cdpConfiguration;
    const debuggerType = isUsingNewDebugger ? PROXY_JS_DEBUGGER_TYPE : OLD_JS_DEBUGGER_TYPE;

    let didStartHandler: Disposable | null = debug.onDidStartDebugSession((session) => {
      if (session.type === debuggerType) {
        this.cdpDebugSession = session;
        didStartHandler?.dispose();
        didStartHandler = null;
      }
    });

    const sourceMapPathOverrides: Record<string, string> = {};
    if (isUsingNewDebugger && metroWatchFolders.length > 0) {
      sourceMapPathOverrides["/[metro-project]/*"] = `${metroWatchFolders[0]}${path.sep}*`;
      metroWatchFolders.forEach((watchFolder, index) => {
        sourceMapPathOverrides[`/[metro-watchFolders]/${index}/*`] = `${watchFolder}${path.sep}*`;
      });
    }

    try {
      await debug.startDebugging(
        undefined,
        {
          type: debuggerType,
          name: "React Native JS Debugger",
          request: "attach",
          breakpointsAreRemovedOnContextCleared: isUsingNewDebugger ? false : true, // new debugger properly keeps all breakpoints in between JS reloads
          sourceMapPathOverrides,
          websocketAddress,
          expoPreludeLineCount,
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
