import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { commands, Uri } from "vscode";

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

// FIXME: Temporary workaround for being unable to await chat request
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function testChatToolUsage() {
  const runStatus: ChatTestResult[] = [];

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

  const dir = await mkdtemp(path.join(tmpdir(), "radon-chat-exports-"));

  for (const testCase of testCases) {
    await commands.executeCommand("workbench.panel.chat.view.copilot.focus");

    // Rejection requires confirmation (human input), acceptance does not.
    await commands.executeCommand("chatEditing.acceptAllFiles");

    // TODO: Revert all changes via git

    await commands.executeCommand("workbench.action.chat.newChat");
    await commands.executeCommand("workbench.action.chat.openagent", testCase.prompt);

    await sleep(10_000); // FIXME: Fixed timouts like this are unacceptable on prod

    // TODO: Add a way to interrupt & cancel the process

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

    // TODO: Check all, not only the first one
    const toolCall = responses.find((response) => isToolCallResponse(response));

    if (toolCall?.toolId === undefined) {
      fail(testCase, "No tools were called.");
      continue;
    }

    if (testCase.allowedToolIds.includes(toolCall.toolId)) {
      success(testCase);
    } else {
      const expected = `expected tool call to ${testCase.allowedToolIds.join(" or ")}`;
      const received = `received tool call to ${toolCall.toolId}`;
      const cause = `${expected}\n${received}`;
      fail(testCase, cause);
    }
  }

  // TODO: Rework error reporting, use more structured approach with metadata
  console.error(runStatus);
}
