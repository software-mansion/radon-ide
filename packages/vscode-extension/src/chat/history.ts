import * as vscode from "vscode";
import { CHAT_PARTICIPANT_ID } from ".";

const START_OF_PREVIOUS_RESPONSES = "\n# PREVIOUS RESPONSES:\n\n";
const END_OF_PREVIOUS_RESPONSES = "\n# END OF PREVIOUS RESPONSES.\n\n";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function getChatHistory(context: vscode.ChatContext): ChatMessage[] {
  const chatMessageHistory = context.history.filter(
    (chatTurn) => chatTurn.participant === CHAT_PARTICIPANT_ID
  );

  const history: ChatMessage[] = [];

  if (chatMessageHistory.length > 0) {
    chatMessageHistory.forEach((chatMessage) => {
      if ("prompt" in chatMessage) {
        history.push({ role: "user", content: chatMessage.prompt });
      }
      if ("response" in chatMessage) {
        chatMessage.response.forEach((r) => {
          if (r instanceof vscode.ChatResponseMarkdownPart) {
            history.push({ role: "assistant", content: r.value.value });
          }
        });
      }
    });
  }

  return history;
}

export function formatChatHistory(chatHistory: ChatMessage[]): string {
  let chatHistoryText = START_OF_PREVIOUS_RESPONSES;

  chatHistory.forEach((chatMessage) => {
    chatHistoryText += `${chatMessage.role.toUpperCase()}: ${chatMessage.content}\n\n`;
  });

  chatHistoryText += END_OF_PREVIOUS_RESPONSES;

  return chatHistoryText;
}
