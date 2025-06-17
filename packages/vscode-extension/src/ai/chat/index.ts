import * as vscode from "vscode";
import { Logger } from "../../Logger";
import { getLicenseToken } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { getChatHistory } from "./history";
import { getReactNativePackagesPrompt } from "./packages";
import { getSystemPrompt, invokeToolCall } from "../shared/api";

export const CHAT_PARTICIPANT_ID = "chat.radon-ai";
const TOOLS_INTERACTION_LIMIT = 3;
export const CHAT_LOG = "[CHAT]";

async function processChatResponse(
  chatResponse: vscode.LanguageModelChatResponse,
  stream: vscode.ChatResponseStream,
  jwt: string
): Promise<vscode.LanguageModelChatMessage[] | null> {
  for await (const chunk of chatResponse.stream) {
    if (chunk instanceof vscode.LanguageModelTextPart) {
      stream.markdown(chunk.value);
    } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
      const toolCall = chunk;
      Logger.info(CHAT_LOG, "Tool call requested");
      const results = await invokeToolCall(toolCall.name, toolCall.input, toolCall.callId);
      const toolMessages = [];
      for (const response of results.content) {
        if (response.type === "text") {
          toolMessages.push(
            vscode.LanguageModelChatMessage.Assistant(
              `"${chunk.name}" has been called - results:\n\n\`\`\`\n${response}\n\`\`\``
            )
          );
        } else {
          // Chats with chat-participants do not support image tool outputs yet.
          // This `else` is unreachable in practice, but might become reachable as a result of a coding mistake.
          const msg = `"${chunk.name}" has been called - image-returning tools are not supported in participant chats.`;
          getTelemetryReporter().sendTelemetryEvent("radon-chat:tool-output-error", { error: msg });
          toolMessages.push(vscode.LanguageModelChatMessage.Assistant(msg));
        }
      }

      return [
        ...toolMessages,
        // request.model.sendRequest API requires the last message to be of type `User`
        vscode.LanguageModelChatMessage.User("All requested tool calls have been executed."),
      ];
    }
  }

  return [];
}

export function registerRadonChat(context: vscode.ExtensionContext) {
  const chatHandler: vscode.ChatRequestHandler = async (
    request,
    chatContext,
    stream,
    token
  ): Promise<vscode.ChatResult> => {
    stream.progress("Thinking...");
    Logger.info(CHAT_LOG, "Chat requested");
    getTelemetryReporter().sendTelemetryEvent("radon-chat:requested");

    const jwt = await getLicenseToken();

    if (!jwt) {
      const msg =
        "You need to have a valid license to use the Radon AI Chat. Please activate your license.";
      Logger.warn(CHAT_LOG, msg);
      getTelemetryReporter().sendTelemetryEvent("radon-chat:no-license-error", { error: msg });
      stream.markdown(msg);
      return { metadata: { command: "" } };
    }

    const packages = await getReactNativePackagesPrompt();

    try {
      const data = await getSystemPrompt(request.prompt);
      if (!data) {
        stream.markdown("Couldn't connect to Radon AI.");
        return { metadata: { command: "" } };
      }

      const { system, context: documentation, tools } = data;

      if (!system || !documentation) {
        let msg = `Failed to fetch system prompt.`;
        Logger.error(CHAT_LOG, msg);
        getTelemetryReporter().sendTelemetryEvent("radon-chat:retrieval-error", { error: msg });
        stream.markdown("Couldn't connect to Radon AI. Is your Radon IDE license active?");
        return { metadata: { command: "" } };
      }

      const chatHistory = getChatHistory(chatContext);
      const messages = [...chatHistory];
      const messageRequests = [
        vscode.LanguageModelChatMessage.Assistant(documentation),
        vscode.LanguageModelChatMessage.Assistant(packages),
        vscode.LanguageModelChatMessage.Assistant(system),
        vscode.LanguageModelChatMessage.User(request.prompt),
      ];

      for (
        let toolInteractionCount = 0;
        messageRequests.length > 0 && toolInteractionCount < TOOLS_INTERACTION_LIMIT;
        toolInteractionCount++
      ) {
        messages.push(...messageRequests);
        messageRequests.length = 0;

        const chatResponse = await request.model.sendRequest(
          messages,
          {
            tools,
            justification:
              "Radon AI uses a language model to answer React Native related questions.",
          },
          token
        );
        const newMessages = await processChatResponse(chatResponse, stream, jwt);

        if (newMessages === null) {
          return { metadata: { command: "" } };
        }

        messageRequests.push(...newMessages);
      }
    } catch (err) {
      handleError(err, stream);
    }

    getTelemetryReporter().sendTelemetryEvent("radon-chat:responded");
    return { metadata: { command: "" } };
  };

  const chat = vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, chatHandler);
  chat.iconPath = vscode.Uri.joinPath(context.extensionUri, "/assets/logo.png");

  context.subscriptions.push(
    chat.onDidReceiveFeedback((feedback: vscode.ChatResultFeedback) => {
      // Log chat result feedback to be able to compute the success matrix of the participant
      // unhelpful / totalRequests is a good success metric
      const kind =
        feedback.kind === vscode.ChatResultFeedbackKind.Unhelpful ? "unhelpful" : "helpful";
      getTelemetryReporter().sendTelemetryEvent(`radon-chat:feedback:${kind}`);
    })
  );
}

function handleError(err: unknown, stream: vscode.ChatResponseStream): void {
  if (err instanceof vscode.LanguageModelError) {
    Logger.error(CHAT_LOG, err.message, err.code, err.cause);
    getTelemetryReporter().sendTelemetryEvent("radon-chat:error", {
      error: err.message,
      code: err.code,
    });

    // making the chat request might fail because
    switch (err.code) {
      // model does not exist
      case vscode.LanguageModelError.NotFound.name:
        stream.markdown("The selected model does not exist.");
        break;
      // user consent not given
      case vscode.LanguageModelError.NoPermissions.name:
        stream.markdown("You need to give permission to the language model to use the Radon AI.");
        break;
      // quote limits exceeded
      case vscode.LanguageModelError.Blocked.name:
        stream.markdown(
          "Github Copilot quote limits exceeded. Upgrade Copilot Pro to keep using Radon AI."
        );
        break;
    }

    if (err.cause instanceof Error && err.cause.message.includes("off_topic")) {
      stream.markdown("I'm sorry, I can only explain React Native concepts.");
    }
  } else {
    Logger.error(CHAT_LOG, err);
    getTelemetryReporter().sendTelemetryEvent("radon-chat:unknown-error", {
      error: err instanceof Error ? err.message : String(err),
    });
    // re-throw other errors so they show up in the UI
    throw err;
  }
}
