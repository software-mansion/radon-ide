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

interface ToolCallResponse {
  kind: "toolInvocationSerialized";
  toolId: string;
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

export function testChatToolUsage() {
  // TODO:
  // - Register this util only in development mode
  // - New chat
  // - Send chat message command.
  // - Retrieve chat history - check if tools were used

  const testPrompts = [
    "How to use Shared Element Transitions in Reanimated 4?",
    "How to use Shared Element Transitions in Reanimated?",
    "How to use SETs in Reanimated?",
    "Implement an example interaction with a local LLM in my app.",
    "Add LLM chat.",
    "My button in the center of the screen is malformed.",
    "The orange button is ugly. Fix it.",
  ];

  for (const prompt of testPrompts) {
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

    // TODO: Make dynamic
    if (toolCall?.toolId === "query_documentation") {
      // Success
    }

    // Fail
  }
}
