import * as vscode from "vscode";
import { getLicenseToken } from "../utilities/license";

const CHAT_PARTICIPANT_ID = "chat.radon-ai";

const START_OF_DOCUMENTATION = "\n# RELEVANT DOCUMENTATION:\n\n";
const END_OF_DOCUMENTATION = "\n# END OF DOCUMENTATION.\n\n";
const START_OF_PREVIOUS_RESPONSES = "\n# PREVIOUS RESPONSES:\n\n";
const END_OF_PREVIOUS_RESPONSES = "\n# END OF PREVIOUS RESPONSES.\n\n";
const HELPFUL_ASSISTANT = `
You are a React Native expert.\n\n
You are provided with detailed documentation and context.\n\n
Answer any and all user questions regarding React Native.\n\n
Always assume that the user already has a development environment set up for React Native and Expo.\n\n
`;
const START_OF_USER_QUESTION = "\n# ANSWER THE FOLLOWING USER QUESTION:\n\n";

const BASE_RADON_AI_URL = "http://127.0.0.1:8000";

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

    const jwt = await getLicenseToken();

    // TODO: don't allow to use Radon AI when no license token is available

    try {
      let json;
      try {
        const url = new URL("/api/documentation", BASE_RADON_AI_URL);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwt}`,
          },
          body: JSON.stringify({ prompt: request.prompt }),
        });
        json = await response.json();
      } catch (error) {
        console.error(error);
      }

      let systemPrompt = "";

      if (json) {
        systemPrompt += START_OF_DOCUMENTATION + json.docs + END_OF_DOCUMENTATION;
      }

      const previousResponses = chatContext.history.filter(
        (chatTurn) => chatTurn.participant === CHAT_PARTICIPANT_ID
      );

      if (previousResponses.length > 0) {
        let history = "";
        previousResponses.forEach((response) => {
          if ("prompt" in response) {
            history += `USER: ${response.prompt}\n\n`;
          }
          if ("response" in response) {
            response.response.forEach((r) => {
              if (r instanceof vscode.ChatResponseMarkdownPart) {
                history += `ASSISTANT: ${r.value.value}\n\n`;
              }
            });
          }
        });

        systemPrompt += START_OF_PREVIOUS_RESPONSES + history + END_OF_PREVIOUS_RESPONSES;
      }

      systemPrompt += HELPFUL_ASSISTANT + START_OF_USER_QUESTION;

      const messages = [
        vscode.LanguageModelChatMessage.Assistant(systemPrompt),
        vscode.LanguageModelChatMessage.User(request.prompt),
      ];

      const chatResponse = await request.model.sendRequest(messages, {}, token);
      for await (const fragment of chatResponse.text) {
        stream.markdown(fragment);
      }
    } catch (err) {
      handleError(logger, err, stream);
    }

    logger.logUsage("chatRequest", { kind: "" });
    return { metadata: { command: "" } };
  };

  const chat = vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, handler);
  chat.iconPath = vscode.Uri.joinPath(context.extensionUri, "/assets/logo.png");

  // TODO: add capture telemetry
  const logger = vscode.env.createTelemetryLogger({
    sendEventData(eventName, data) {
      // Capture event telemetry
      console.log(`Event: ${eventName}`);
      console.log(`Data: ${JSON.stringify(data)}`);
    },
    sendErrorData(error, data) {
      // Capture error telemetry
      console.error(`Error: ${error}`);
      console.error(`Data: ${JSON.stringify(data)}`);
    },
  });

  context.subscriptions.push(
    chat.onDidReceiveFeedback((feedback: vscode.ChatResultFeedback) => {
      // Log chat result feedback to be able to compute the success matrix of the participant
      // unhelpful / totalRequests is a good success metric
      logger.logUsage("chatResultFeedback", {
        kind: feedback.kind,
      });
    })
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(
  logger: vscode.TelemetryLogger,
  err: any,
  stream: vscode.ChatResponseStream
): void {
  // making the chat request might fail because
  // - model does not exist
  // - user consent not given
  // - quote limits exceeded
  logger.logError(err);

  if (err instanceof vscode.LanguageModelError) {
    console.log(err.message, err.code, err.cause);
    if (err.cause instanceof Error && err.cause.message.includes("off_topic")) {
      stream.markdown(vscode.l10n.t("I'm sorry, I can only explain React Native concepts."));
    }
  } else {
    // re-throw other errors so they show up in the UI
    throw err;
  }
}
