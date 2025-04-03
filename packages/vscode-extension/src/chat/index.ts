import * as vscode from "vscode";
import { Logger } from "../Logger";
import { getLicenseToken } from "../utilities/license";
import { getTelemetryReporter } from "../utilities/telemetry";
import { invokeToolCall, getSystemPrompt } from "./api";
import { getChatHistory } from "./history";
import { getReactNativePackagesPrompt } from "./packages";

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
      Logger.info(CHAT_LOG, "Tool call requested");
      const results = await invokeToolCall(chunk, jwt);

      if (!results) {
        stream.markdown("Radon AI couldn't execute tool call.");
        return null;
      }

      const toolMessages = results.map((result) =>
        // result.content will always be a 1-long array of strings
        vscode.LanguageModelChatMessage.Assistant(
          `"${chunk.name}" has been called - results:\n\n\`\`\`\n${result.content[0]}\n\`\`\``
        )
      );

      return [
        ...toolMessages,
        // request.model.sendRequest API requires the last message to be of type `User`
        vscode.LanguageModelChatMessage.User("All requested tool calls have been executed."),
      ];
    }
  }

  return [];
}

export function registerChat(context: vscode.ExtensionContext) {
  const chatHandler: vscode.ChatRequestHandler = async (
    request,
    chatContext,
    stream,
    token
  ): Promise<vscode.ChatResult> => {
    stream.progress("Thinking...");
    Logger.info(CHAT_LOG, "Chat requested");
    getTelemetryReporter().sendTelemetryEvent("chat:requested");

    const jwt = await getLicenseToken();

    if (!jwt) {
      Logger.warn(CHAT_LOG, "No license found. Please activate your license.");
      getTelemetryReporter().sendTelemetryEvent("chat:requested:no-license");

      stream.markdown(
        "You need to have a valid license to use the Radon AI Chat. Please activate your license."
      );
      return { metadata: { command: "" } };
    }

    // Calling this function will not trigger a consent UI but just checks for a persisted state.
    if (!context.languageModelAccessInformation.canSendRequest(request.model)) {
      Logger.error(CHAT_LOG, "the language model does not exist or consent hasn't been asked for");
      stream.markdown(
        "The selected model does not exist or consent hasn't been asked for. Please check your GitHub Copilot settings."
      );
      return { metadata: { command: "" } };
    }

    const packages = await getReactNativePackagesPrompt();

    try {
      const data = await getSystemPrompt(request.prompt, jwt);
      if (!data) {
        stream.markdown("Couldn't connect to Radon AI.");
        return { metadata: { command: "" } };
      }

      const { system, context: documentation, tools } = data;

      if (!system || !documentation) {
        Logger.error(CHAT_LOG, "No system prompt received from Radon AI.");
        getTelemetryReporter().sendTelemetryEvent("chat:error", {
          error: "No system prompt received from Radon AI.",
        });

        stream.markdown("Couldn't connect to Radon AI.");
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

    getTelemetryReporter().sendTelemetryEvent("chat:responded");
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
      getTelemetryReporter().sendTelemetryEvent(`chat:feedback:${kind}`);
    })
  );
}

function handleError(err: unknown, stream: vscode.ChatResponseStream): void {
  if (err instanceof vscode.LanguageModelError) {
    Logger.error(CHAT_LOG, err.message, err.code, err.cause);
    getTelemetryReporter().sendTelemetryEvent("chat:error", {
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
    getTelemetryReporter().sendTelemetryEvent("chat:error", { error: "Unknown error" });
    // re-throw other errors so they show up in the UI
    throw err;
  }
}
