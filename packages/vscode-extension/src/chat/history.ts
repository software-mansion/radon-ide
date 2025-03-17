import * as vscode from "vscode";
import { CHAT_PARTICIPANT_ID } from ".";

export function getChatHistory(context: vscode.ChatContext): vscode.LanguageModelChatMessage[] {
  const chatMessageHistory = context.history.filter(
    (chatTurn) => chatTurn.participant === CHAT_PARTICIPANT_ID
  );

  const history: vscode.LanguageModelChatMessage[] = [];

  if (chatMessageHistory.length > 0) {
    chatMessageHistory.forEach((chatMessage) => {
      if ("prompt" in chatMessage) {
        history.push(vscode.LanguageModelChatMessage.User(chatMessage.prompt));
      }
      if ("response" in chatMessage) {
        chatMessage.response.forEach((r) => {
          if (r instanceof vscode.ChatResponseMarkdownPart) {
            history.push(vscode.LanguageModelChatMessage.Assistant(r.value.value));
          }
        });
      }
    });
  }

  return history;
}
