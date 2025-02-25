import { IProtocolCommand, IProtocolSuccess, IProtocolError, Cdp } from "vscode-cdp-proxy";
import { debug } from "vscode";
import { CDPProxyDelegate } from "./CDPProxy";
import { DebugSessionDelegate } from "./DebugSession";

export class RadonCDPProxyDelegate implements CDPProxyDelegate {
  constructor(private debugSessionDelegate: DebugSessionDelegate) {}
  public handleApplicationCommand(command: IProtocolCommand): IProtocolCommand | undefined {
    switch (command.method) {
      case "Runtime.consoleAPICalled": {
        return this.handleConsoleAPICalled(command);
      }
      case "Debugger.paused": {
        this.debugSessionDelegate.onDebuggerPaused({
          event: "RNIDE_paused",
          session: debug.activeDebugSession!,
          body: {},
        });
        return command;
      }
      // case "Debugger.resumed": {
      //   this.debugSessionDelegate.onDebuggerPaused({
      //     event: "RNIDE_continued",
      //     session: debug.activeDebugSession!,
      //     body: {},
      //   });
      //   return command;
      // }
    }
    return command;
  }
  public handleDebuggerCommand(command: IProtocolCommand): IProtocolCommand | undefined {
    switch (command.method) {
      case "Debugger.resume": {
        this.debugSessionDelegate.onDebuggerResumed({
          event: "RNIDE_continued",
          session: debug.activeDebugSession!,
          body: {},
        });
        return command;
      }
    }
    return command;
  }
  public handleApplicationReply(
    reply: IProtocolSuccess | IProtocolError
  ): IProtocolSuccess | IProtocolError | undefined {
    return reply;
  }
  public handleDebuggerReply(
    reply: IProtocolSuccess | IProtocolError
  ): IProtocolSuccess | IProtocolError | undefined {
    return reply;
  }

  private handleConsoleAPICalled(command: IProtocolCommand): IProtocolCommand | undefined {
    // We wrap console calls and add stack information as last three arguments, however
    // some logs may baypass that, especially when printed in initialization phase, so we
    // need to detect whether the wrapper has added the stack info or not
    // We check if there are more than 3 arguments, and if the last one is a number
    // We filter out logs that start with __RNIDE_INTERNAL as those are messages
    // used by IDE for tracking the app state and should not appear in the VSCode
    // console.
    const { args, stackTrace } = command.params as Cdp.Runtime.ConsoleAPICalledEvent;
    if (args.length > 0 && args[0].value === "__RNIDE_INTERNAL") {
      // We return here to avoid passing internal logs to the user debug console,
      // but they will still be visible in metro log feed.
      return undefined;
    }
    if (args.length > 3 && args[args.length - 1].type === "number") {
      // Since console.log stack is extracted from Error, unlike other messages sent over CDP
      // the line and column numbers are 1-based
      const [scriptURL, generatedLineNumber1Based, generatedColumn1Based] = args
        .splice(-3)
        .map((v) => v.value);

      // we find the frame received from the wrapped in the stack and remove all frames above it
      const originalCallFrameIndex = stackTrace?.callFrames.findIndex((frame) => {
        return (
          frame.url === scriptURL &&
          frame.lineNumber === generatedLineNumber1Based - 1 &&
          frame.columnNumber === generatedColumn1Based
        );
      });

      stackTrace?.callFrames.splice(0, originalCallFrameIndex);

      return command;
    }

    return command;
  }
}
