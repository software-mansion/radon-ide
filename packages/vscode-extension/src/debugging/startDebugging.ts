import assert from "assert";
import * as vscode from "vscode";
import { debug, Disposable } from "vscode";

/**
 * Helper function that starts a debug session and returns the session object upon sucesfull start
 */
export async function startDebugging(
  folder: vscode.WorkspaceFolder | undefined,
  nameOrConfiguration: string | vscode.DebugConfiguration,
  parentSessionOrOptions?: vscode.DebugSession | vscode.DebugSessionOptions
) {
  const debugSessionType =
    typeof nameOrConfiguration === "string" ? nameOrConfiguration : nameOrConfiguration.type;
  let debugSession: vscode.DebugSession | undefined;
  let didStartHandler: Disposable | null = debug.onDidStartDebugSession((session) => {
    if (session.type === debugSessionType) {
      didStartHandler?.dispose();
      didStartHandler = null;
      debugSession = session;
    }
  });
  try {
    const debugStarted = await debug.startDebugging(
      folder,
      nameOrConfiguration,
      parentSessionOrOptions
    );

    if (debugStarted) {
      // NOTE: this is safe, because `debugStarted` means the session started successfully,
      // and we set the session in the `onDidStartDebugSession` handler
      assert(debugSession, "Expected debug session to be set");
      return debugSession;
    } else {
      throw new Error("Failed to start debug session");
    }
  } finally {
    didStartHandler?.dispose();
  }
}
