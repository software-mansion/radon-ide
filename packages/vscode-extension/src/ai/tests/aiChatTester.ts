import { commands } from "vscode";

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

const placeholderChatData: ChatData = {
  requests: [
    {
      response: [
        {
          kind: "toolInvocationSerialized",
          toolId: "query_documentation",
        },
      ],
    },
  ],
};

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

  for (const testCase of testCases) {
    await commands.executeCommand("workbench.action.chat.newChat");
    await commands.executeCommand("workbench.action.chat.open", testCase.prompt);

    // FIXME: Await agent's response.
    // TODO: Export chat, load the .json file
    const chatData = placeholderChatData;

    if (chatData.requests.length === 0) {
      fail(testCase, "Internal error: `workbench.action.chat.open` did not work.");
      continue;
    }

    if (chatData.requests.length > 1) {
      fail(testCase, "Internal error: `workbench.action.chat.newChat` did not work.");
      continue;
    }

    const responses = chatData.requests[0].response;

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
