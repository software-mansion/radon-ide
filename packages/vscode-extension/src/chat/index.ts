import * as vscode from "vscode";
import { Logger } from "../Logger";
import { getLicenseToken } from "../utilities/license";
import { getTelemetryReporter } from "../utilities/telemetry";
import { executeToolCall as invokeToolCall, getSystemPrompt } from "./api";
import { getChatHistory } from "./history";

export const CHAT_PARTICIPANT_ID = "chat.radon-ai";
const TOOLS_INTERACTION_LIMIT = 3;

interface IChatResult extends vscode.ChatResult {
  metadata: {
    command: string;
  };
}

export function registerChat(context: vscode.ExtensionContext) {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<IChatResult> => {
    stream.progress("Thinking...");
    Logger.info("Chat requested");

    const jwt = await getLicenseToken();

    if (!jwt) {
      Logger.warn("No license found. Please activate your license.");
      getTelemetryReporter().sendTelemetryEvent("chat:requested:no-license");

      stream.markdown(
        "You need to have a valid license to use the Radon AI Chat. Please activate your license."
      );
      return { metadata: { command: "" } };
    }

    try {
      const data = await getSystemPrompt(request.prompt, jwt);
      if (!data) {
        stream.markdown("Couldn't connect to Radon AI.");
        return { metadata: { command: "" } };
      }

      const { system, context: documentation, tools } = data;

      if (!system || !documentation) {
        Logger.error("No system prompt received from Radon AI.");
        getTelemetryReporter().sendTelemetryEvent("chat:error", {
          error: "No system prompt received from Radon AI.",
        });

        stream.markdown("Couldn't connect to Radon AI.");
        return { metadata: { command: "" } };
      }

      const chatHistory = getChatHistory(chatContext);

      const messages = [
        ...chatHistory,
        vscode.LanguageModelChatMessage.Assistant(documentation),
        vscode.LanguageModelChatMessage.Assistant(system),
        vscode.LanguageModelChatMessage.User(request.prompt),
      ];

      const carryOverMessages: vscode.LanguageModelChatMessage[] = [];
      let toolInteractionCount = 0;

      do {
        messages.push(...carryOverMessages);
        carryOverMessages.length = 0;

        const chatResponse = await request.model.sendRequest(messages, { tools }, token);

        for await (const chunk of chatResponse.stream) {
          if (chunk instanceof vscode.LanguageModelTextPart) {
            stream.markdown(chunk.value);
          } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
            const results = await invokeToolCall(chunk, jwt);

            if (!results) {
              stream.markdown("Radon AI couldn't execute tool call.");
              return { metadata: { command: "" } };
            }

            const toolMessages = results.map((result) =>
              // result.content will always be a 1-long array of strings
              vscode.LanguageModelChatMessage.Assistant(
                `"${chunk.name}" has been called - results:\n\n\`\`\`\n${result.content[0]}\n\`\`\``
              )
            );

            carryOverMessages.push(
              ...toolMessages,
              // request.model.sendRequest API requires `User` to be the last message
              vscode.LanguageModelChatMessage.User("All requested tool calls have been executed.")
            );

            toolInteractionCount++;
          }
        }
      } while (carryOverMessages.length > 0 && toolInteractionCount < TOOLS_INTERACTION_LIMIT);
    } catch (err) {
      Logger.error("Error: ", err);
      handleError(err, stream);
    }

    getTelemetryReporter().sendTelemetryEvent("chat:responded");
    return { metadata: { command: "" } };
  };

  const chat = vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, handler);
  chat.iconPath = vscode.Uri.joinPath(context.extensionUri, "/assets/logo.png");

  context.subscriptions.push(
    chat.onDidReceiveFeedback((feedback: vscode.ChatResultFeedback) => {
      // Log chat result feedback to be able to compute the success matrix of the participant
      // unhelpful / totalRequests is a good success metric
      const kind =
        feedback.kind === vscode.ChatResultFeedbackKind.Unhelpful ? "unhelpful" : "helpful";
      getTelemetryReporter().sendTelemetryEvent(`chat:feedback:${kind}`);
    })
  );
}

function handleError(err: unknown, stream: vscode.ChatResponseStream): void {
  // making the chat request might fail because
  // - model does not exist
  // - user consent not given
  // - quote limits exceeded
  if (err instanceof Error) {
    Logger.error(err.message);
    getTelemetryReporter().sendTelemetryEvent("chat:error", { error: err.message });
  }

  if (err instanceof vscode.LanguageModelError) {
    console.log(err.message, err.code, err.cause);
    if (err.cause instanceof Error && err.cause.message.includes("off_topic")) {
      stream.markdown("I'm sorry, I can only explain React Native concepts.");
    }
  } else {
    // re-throw other errors so they show up in the UI
    throw err;
  }
}
