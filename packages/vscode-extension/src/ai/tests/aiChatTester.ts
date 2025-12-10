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

export function testChatToolUsage() {
  // TODO:
  // - Register this util only in development mode
  // - New chat
  // - Send chat message command.
  // - Retrieve chat history - check if tools were used

  for (const testCase of testCases) {
    commands.executeCommand("workbench.action.chat.newChat", prompt);
    commands.executeCommand("workbench.action.chat.open", prompt);

    // TODO: Export chat, load the .json file
    const chatData = placeholderChatData;

    // .requests[0].response[0].toolName
    if (chatData.requests.length === 0) {
      return; // `workbench.action.chat.open` didn't work
    }

    if (chatData.requests.length > 1) {
      return; // `workbench.action.chat.newChat` didn't work
    }

    const responses = chatData.requests[0].response;

    const toolCall = responses.find((response) => isToolCallResponse(response));

    if (toolCall?.toolId === undefined) {
      // Invalid tool called
      return;
    }

    if (testCase.allowedToolIds.includes(toolCall.toolId)) {
      // Success
    }

    // Fail
  }
}
