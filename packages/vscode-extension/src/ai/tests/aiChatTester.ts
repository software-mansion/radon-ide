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

type AllowedToolId =
  | "query_documentation"
  | "view_screenshot"
  | "view_component_tree"
  | "view_application_logs"
  | "reload_application";

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

  {
    prompt: "Restart the app.",
    allowedToolIds: ["reload_application"],
  },
  {
    prompt: "The app is frozen. Can you reset it?",
    allowedToolIds: ["reload_application"],
  },

  {
    prompt: "Why did the app just crash?",
    allowedToolIds: ["view_application_logs"],
  },
  {
    prompt: "Are there any errors in the logs?",
    allowedToolIds: ["view_application_logs"],
  },
  {
    prompt: "Debug the error thrown when I clicked the login button.",
    allowedToolIds: ["view_application_logs", "view_component_tree"],
  },

  {
    prompt: "Does the layout look broken to you?",
    allowedToolIds: ["view_screenshot"],
  },
  {
    prompt: "I think the text is being cut off on the right side.",
    allowedToolIds: ["view_screenshot"],
  },
  {
    prompt: "Verify if the dark mode colors are applied correctly.",
    allowedToolIds: ["view_screenshot"],
  },
  {
    prompt: "Take a look at the current screen.",
    allowedToolIds: ["view_screenshot"],
  },

  {
    prompt: "What is the hierarchy of the current screen?",
    allowedToolIds: ["view_component_tree"],
  },
  {
    prompt: "Show me the props passed to the Header component.",
    allowedToolIds: ["view_component_tree"],
  },
  {
    prompt: "Is the 'Submit' button currently inside a SafeAreaView?",
    allowedToolIds: ["view_component_tree"],
  },
  {
    prompt: "Find the component ID for the bottom navigation bar.",
    allowedToolIds: ["view_component_tree"],
  },

  {
    prompt: "Why is the banner not showing up?",
    allowedToolIds: ["view_component_tree", "view_application_logs", "view_screenshot"],
  },
  {
    prompt: "Inspect the padding on the user profile card.",
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
    const disposable = ideInstance.onStateChanged((partialState) => {
      const continueRunningTests = partialState.areMCPTestsRunning;
      if (continueRunningTests === false) {
        disposable.dispose();
        clearTimeout(timeout);
        resolve(false);
      }
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
    areMCPTestsRunning: areTestsRunning,
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
