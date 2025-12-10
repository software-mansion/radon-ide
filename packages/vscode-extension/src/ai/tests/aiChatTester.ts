import { commands } from "vscode";

export interface ChatData {
  requests: Request[];
}

export interface Request {
  response: Response[];
}

export interface Response {
  kind: string;
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
    const _chatData = placeholderChatData;

    // .requests[0].response[0].toolName
  }
}
