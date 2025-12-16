import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { window, commands, Uri, workspace, StatusBarAlignment, ThemeColor } from "vscode";
import { Logger } from "../../Logger";
import { exec } from "../../utilities/subprocess";
import { Platform } from "../../utilities/platform";
import { sleep } from "../../utilities/retry";

export const GIT_PATH = Platform.select({
  macos: "git",
  windows: "git.exe",
  linux: "git",
});

interface ChatData {
  requests: Request[];
}

interface Request {
  response: Response[];
}

type Response = ToolCallResponse | UnknownResponse;

interface UnknownResponse {
  // `Exclude<string, "literal">` resolves to `string` (does not work)
  kind: unknown;
}

type AllowedToolId = "query_documentation" | "view_screenshot" | "view_component_tree";

interface ToolCallResponse {
  kind: "toolInvocationSerialized";
  toolId: AllowedToolId;
}

interface ChatTestCase {
  prompt: string;
  allowedToolIds: AllowedToolId[];
}

interface ChatTestResult {
  prompt: string;
  success: boolean;
  cause: string | null;
}

function isToolCallResponse(response: Response): response is ToolCallResponse {
  // Smart-casting with `Exclude<string, "literal">` does not work, which is why this utility function is necessary
  return response.kind === "toolInvocationSerialized";
}

const testCases: ChatTestCase[] = [
  {
    prompt: "How to use Shared Element Transitions in Reanimated 4?",
    allowedToolIds: ["query_documentation"],
  },
  {
    prompt: "How to use SETs in Reanimated?",
    allowedToolIds: ["query_documentation"],
  },
  {
    prompt: "Implement an example interaction with a local LLM in my app.",
    allowedToolIds: ["query_documentation"],
  },
  {
    prompt: "Add LLM chat to my app.",
    allowedToolIds: ["query_documentation"],
  },
  {
    prompt: "My button in the center of the screen is malformed.",
    allowedToolIds: ["view_component_tree", "view_screenshot"],
  },
  {
    prompt: "The orange button is ugly. Fix it.",
    allowedToolIds: ["view_component_tree", "view_screenshot"],
  },
];

async function clearEdits() {
  // Stop previous response - prevents pop-ups on `workbench.action.chat.newChat`.
  await commands.executeCommand("workbench.action.chat.cancel");

  // Move cursor to input - REQUIRED for `chatEditing.acceptAllFiles`.
  await commands.executeCommand("workbench.panel.chat.view.copilot.focus");

  // Rejection requires user confirmation, acceptance does not.
  await commands.executeCommand("chatEditing.acceptAllFiles");

  const gitUri = workspace.workspaceFolders?.[0].uri;

  if (!gitUri) {
    // This case will never occur when tests are being run in a test up.
    return;
  }

  // Revert all changes via git - **cannot** use `commands.executeCommand`, as it requires user confirmation.
  await exec(GIT_PATH, ["-C", gitUri.fsPath, "restore", "."]);
}

function setGlobalTestsRunning(areTestsRunning: boolean) {
  commands.executeCommand("setContext", "RNIDE.MCPToolTestsRunning", areTestsRunning);
}

function throwOnTestTerminationSignal(): Promise<void> {
  return new Promise((_, reject) => {
    this.stateManager.onSetState(() => {
      const terminateMCPTests = this.stateManager.getState().shouldTerminateMCPTests;

      if (terminateMCPTests) {
        reject();
      }
    });
  });
}

async function setTestTerminationSignal(terminate: boolean) {
  this.stateManager.updateState({
    shouldTerminateMCPTests: terminate,
  });
}

export function terminateChatToolTest() {
  setTestTerminationSignal(true);
}

export async function testChatToolUsage(): Promise<void> {
  const runStatus: ChatTestResult[] = [];

  setGlobalTestsRunning(true);

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

  // - `showInformationMessage` cannot be programatically dismissed
  // - `showQuickPick` is a list-selection - does not look right
  // - `createStatusBarItem` looks good, and can be dismissed both programatically and by the user
  const statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 0);
  statusBar.command = "RNIDE.terminateMCPToolTests";
  statusBar.text = "$(debug-stop) MCP tests running — Terminate";
  statusBar.tooltip = "Click to terminate running E2E tests";
  statusBar.color = new ThemeColor("statusBar.foreground");
  statusBar.backgroundColor = new ThemeColor("statusBarItem.errorBackground");
  statusBar.show();

  const dir = await mkdtemp(path.join(tmpdir(), "radon-chat-exports-"));

  for (const testCase of testCases) {
    clearEdits();

    await commands.executeCommand("workbench.action.chat.newChat");
    await commands.executeCommand("workbench.action.chat.openagent", testCase.prompt);

    // FIXME: Fixed timouts like this should be removed if possible
    try {
      await Promise.race([sleep(10_000), throwOnTestTerminationSignal()]);
    } catch {
      setTestTerminationSignal(false);
      break;
    }

    const filepath = dir + randomBytes(8).toString("hex") + ".json";

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
      fail(testCase, "Internal error: `workbench.action.chat.open` did not work.");
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
    for (const toolCall of toolCalls) {
      if (testCase.allowedToolIds.includes(toolCall.toolId)) {
        success(testCase);
        continue;
      }

      otherCalledTools.push(toolCall.toolId);
    }

    const expected = `Expected: ${testCase.allowedToolIds.join(" | ")}`;
    const received = `Received: ${otherCalledTools.join(", ")}`;
    const cause = `${expected}. ${received}`;
    fail(testCase, cause);
  }

  setGlobalTestsRunning(false);

  clearEdits();

  statusBar.hide();
  statusBar.dispose();

  // TODO: Move results to modal
  const response = `\n=== AI TEST RESULTS ===\n${runStatus.map((v) => `${v.success ? " OK " : "FAIL"}${v.cause !== null ? ` | Error: ${v.cause}` : ""}`).join("\n")}`;
  Logger.log(response);
}
