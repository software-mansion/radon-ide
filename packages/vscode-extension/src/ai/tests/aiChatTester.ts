import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { window, commands, Uri, workspace, StatusBarAlignment, ThemeColor } from "vscode";
import { Logger } from "../../Logger";
import { exec } from "../../utilities/subprocess";
import { Platform } from "../../utilities/platform";
import { IDE } from "../../project/ide";
import { testCases } from "./chatTestCases";
import { Response, ToolCallResponse, ChatTestResult, ChatTestCase, ChatData } from "./models";

export const GIT_PATH = Platform.select({
  macos: "git",
  windows: "git.exe",
  linux: "git",
});

function isToolCallResponse(response: Response): response is ToolCallResponse {
  // Smart-casting with `Exclude<string, "literal">` does not work, which is why this utility function is necessary
  return response.kind === "toolInvocationSerialized";
}

async function clearEdits() {
  // Stop previous response - prevents pop-ups on `workbench.action.chat.newChat`.
  await commands.executeCommand("workbench.action.chat.cancel");

  // Move cursor to input - REQUIRED for `chatEditing.acceptAllFiles`.
  await commands.executeCommand("workbench.panel.chat.view.copilot.focus");

  // Rejection requires user confirmation, acceptance does not.
  await commands.executeCommand("chatEditing.acceptAllFiles");

  const gitUri = workspace.workspaceFolders?.[0].uri;

  if (!gitUri) {
    // This case should never occur when a test app is loaded.
    return;
  }

  // Revert all changes via git - we CANNOT use `commands.executeCommand`, as it requires user confirmation.
  await exec(GIT_PATH, ["-C", gitUri.fsPath, "restore", "."]);
}

async function setGlobalTestsRunning(areTestsRunning: boolean) {
  await commands.executeCommand("setContext", "RNIDE.MCPToolTestsRunning", areTestsRunning);
}

function awaitTestTerminationOrTimeout(ideInstance: IDE, testTimeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const disposable = ideInstance.onStateChanged(() => {
      // Using partial state here is much more cumbersome and less readable.
      ideInstance.getState().then((state) => {
        const testsRunning = state.workspaceConfiguration.radonAI.areMCPTestsRunning;
        if (testsRunning === false) {
          disposable.dispose();
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });

    const timeout = setTimeout(() => {
      disposable.dispose();
      resolve(true);
    }, testTimeout);
  });
}

async function setTestStatus(areTestsRunning: boolean, ideInstance: IDE) {
  await setGlobalTestsRunning(areTestsRunning);
  await ideInstance.updateState({
    workspaceConfiguration: {
      radonAI: {
        areMCPTestsRunning: areTestsRunning,
      },
    },
  });
}

function getIdeInstance() {
  const ide = IDE.getInstanceIfExists();

  if (!ide) {
    throw new Error("IDE instance is not initialized. Ensure the Radon IDE panel is open.");
  }

  return ide;
}

/**
 * Executor for `RNIDE.terminateChatToolTest` VSCode command.
 * Terminates ongoing MCP tool tests, which were initiated by `RNIDE.testChatToolUsage` VSCode command.
 */
export async function terminateChatToolTest() {
  const ideInstance = getIdeInstance();
  await setTestStatus(false, ideInstance);
}

/**
 * Executor for `RNIDE.testChatToolUsage` VSCode command.
 * Temporarily takes control over the AI chat tab, testing its responses to various prompts.
 * Running this command may interfere with other VSCode functionalities as well.
 */
export async function testChatToolUsage(): Promise<void> {
  const ideInstance = getIdeInstance();
  const runStatus: ChatTestResult[] = [];

  await setTestStatus(true, ideInstance);

  const fail = (testCase: ChatTestCase, cause: string) => {
    runStatus.push({
      cause,
      success: false,
      prompt: testCase.prompt,
    });
  };

  const success = (testCase: ChatTestCase) => {
    runStatus.push({
      cause: null,
      success: true,
      prompt: testCase.prompt,
    });
  };

  // - `showInformationMessage` cannot be programmatically dismissed
  // - `showQuickPick` is a list-selection - does not look right
  // - `createStatusBarItem` looks good, and can be dismissed both programmatically and by the user
  const statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 0);
  statusBar.command = "RNIDE.terminateChatToolTest";
  statusBar.text = "$(debug-stop) MCP tests running — Terminate";
  statusBar.tooltip = "Click to terminate running E2E tests";
  statusBar.color = new ThemeColor("statusBar.foreground");
  statusBar.backgroundColor = new ThemeColor("statusBarItem.errorBackground");
  statusBar.show();

  const dir = await mkdtemp(path.join(tmpdir(), "radon-chat-exports-"));

  for (const testCase of testCases) {
    await clearEdits();

    await commands.executeCommand("workbench.action.chat.newChat");
    await commands.executeCommand("workbench.action.chat.openagent", testCase.prompt);

    const shouldContinue = await awaitTestTerminationOrTimeout(ideInstance, 10_000);

    if (!shouldContinue) {
      fail(testCase, "User input: Test was terminated early.");
      break;
    }

    const filepath = path.join(dir, randomBytes(8).toString("hex") + ".json");

    await commands.executeCommand("workbench.action.chat.export", Uri.parse(filepath));

    let chatData;
    try {
      const exportedText = readFileSync(filepath).toString();
      chatData = JSON.parse(exportedText) as ChatData;
    } catch {
      fail(testCase, "Internal error: `workbench.action.chat.export` did not work.");
      continue;
    }

    if (chatData.requests.length === 0) {
      fail(testCase, "Internal error: `workbench.action.chat.openagent` did not work.");
      continue;
    }

    if (chatData.requests.length > 1) {
      fail(testCase, "Internal error: `workbench.action.chat.newChat` did not work.");
      continue;
    }

    const responses = chatData.requests[0].response;

    const toolCalls = responses.filter((response) => isToolCallResponse(response));

    if (toolCalls.length === 0) {
      fail(testCase, "No tools were called.");
      continue;
    }

    const otherCalledTools = [];
    let wasExpectedToolCalled = false;

    for (const toolCall of toolCalls) {
      if (testCase.allowedToolIds.includes(toolCall.toolId)) {
        wasExpectedToolCalled = true;
        success(testCase);
        break;
      }

      otherCalledTools.push(toolCall.toolId);
    }

    if (!wasExpectedToolCalled) {
      const expected = `Expected: ${testCase.allowedToolIds.join(" | ")}`;
      const received = `Received: ${otherCalledTools.join(", ")}`;
      const cause = `${expected}. ${received}`;
      fail(testCase, cause);
    }
  }

  await setTestStatus(false, ideInstance);

  statusBar.hide();
  statusBar.dispose();

  rm(dir, { recursive: true }).catch((_e) => {
    // silence the errors, it's fine
  });

  await clearEdits();

  const failReasons = runStatus
    .map((v) => `${v.success ? " OK " : "FAIL"}${v.cause !== null ? ` | Error: ${v.cause}` : ""}`)
    .join("\n");

  const correctCount = runStatus
    .map((v) => (v.success ? 1 : 0) as number)
    .reduce((acc, v) => v + acc);

  const totalCount = runStatus.length;
  const correctPercent = ((correctCount / totalCount) * 100).toFixed(1);

  const response = `\n=== AI TEST RESULTS ===\n${failReasons}\n# TOTAL CORRECT: ${correctCount}/${totalCount} (${correctPercent}%)`;
  Logger.log(response);
}
