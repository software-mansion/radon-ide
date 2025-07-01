---
id: radon-ai
title: Radon AI
sidebar_position: 10
---

Radon AI is a dedicated React Native AI assistant enhanced with up-to-date information about the React Native ecosystem. At its heart is our extensive React Native knowledge database, which is queried before answering your question.

We index all of the popular React Native libraries to match questions to relevant pieces of documentation, providing additional, accurate context to your conversation.

Our knowledge database is updated daily to provide the most up-to-date information.

<img width="550" src="/img/docs/ide_chat_response.png" className="shadow-image"/>

## Pre-requisites

- Cursor Editor or Visual Studio Code 1.99 or newer
- In Visual Studio Code: Access to [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) and [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat). GitHub Copilot Chat comes with a [GitHub Copilot Free](https://docs.github.com/en/copilot/managing-copilot/managing-copilot-as-an-individual-subscriber/managing-copilot-free/about-github-copilot-free) without needing to sign up for another subscription.
- An active [Radon IDE license](/docs/guides/activation-manual)

## Usage in Visual Studio Code

You can use Radon AI in Visual Studio Code as a [GitHub Copilot Chat participant](https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/asking-github-copilot-questions-in-your-ide#chat-participants) or via [Model Context Protocol (MCP) server](https://modelcontextprotocol.io/introduction) in the [agent mode](https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode).

### Use Radon AI as Copilot Chat participant

To start chatting with Radon AI open the GitHub Copilot Chat panel.

Open the vscode command palette (Ctrl+Shift+P or Cmd+Shift+P) and type "Chat: Open Chat" or "Radon IDE: Chat with Radon AI" and select the command.

**Messages that you want to send to Radon AI need to be started with `@radon` prefix.**

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_chat.mp4" type="video/mp4"/>
</video>

Radon AI has the context of the history of previous messages sent in the chat window started with `@radon`. This allows you to send additional follow-up questions.

To start a new conversation open a new chat window.

### Use Radon AI in agent mode

Radon IDE automatically configures and activates Radon AI MCP server for you. Also, VS Code respect the `mcp.json` config from other editors (e.g. `.cursor/mcp.json`) and configuration through `.vscode/mcp.json`.

To access agent mode in Visual Studio code use Ctrl+Shift+I or Cmd+Shift+I.

Alternatively, open vscode command palette (Ctrl+Shift+P or Cmd+Shift+P) and type "Chat: Open Chat" then select agent mode.

<img width="550" src="/img/docs/ai_vscode_agent_mode.png" className="shadow-image"/>

To adjust the configuration of the MCP server choose `Configure Tools...` menu.

<img width="550" src="/img/docs/ai_vscode_choose_tools.png" className="shadow-image"/>

There you can adjust which tools are enabled or disable the Radon AI MCP server completely.

<img width="600" src="/img/docs/ai_vscode_mcp_tools.png" className="shadow-image"/>

## Usage in Cursor

Radon AI assistant integrates with Cursor's `agent mode` via Model Context Protocol (MCP) server.

<img width="550" src="/img/docs/ai_cursor_chat_response.png" className="shadow-image"/>

The Radon IDE automatically adds the Radon AI MCP server configuration by creating a `.cursor/mcp.json` or appending an entry if this file exists. Cursor detects this change and asks you to enable the server.

<img width="400" src="/img/docs/ai_cursor_enable_mcp.png" className="shadow-image"/>

You can to configure the Radon AI MCP server from Cursor Settings. There, you can adjust the server configuration, choose which tools are enabled or disable the MCP server completely.

1. In Cursor, open `Cursor Settings` (Ctrl+Shift+J or Cmd+Shift+J).
2. Navigate to the `Tools & Integrations`.
3. Find the `MCP Tools` section.
4. Select `Radon AI` from the list of available servers.

<img width="550" src="/img/docs/ai_cursor_mcp_settings.png" className="shadow-image"/>

Alternatively, you can type and run "View: Open MCP Settings" from the Command Palette (Ctrl+Shift+P or Cmd+Shift+P).

## Available tools

The AI models automatically discover and invoke tools when they decide it will be useful. You can query the agent to use the tool by mentioning it's name in the prompt. These are currently available tools in Radon AI:

- `get_library_description` Provides a detailed description of a library and its use cases.
- `query_documentation` Retrieves documentation snippets relevant to a provided query.
- `view_screenshot` Captures a device preview screenshot. Can help the agent to debug issues or make UI adjustements. Currenlty only supported in Gemini and Claude models.

## Limitations

1. Radon AI will refuse answering questions outside of the React Native and Expo domain.

2. Like any technology based on large language models, Radon AI is prone to errors. Make sure to check important information before making decisions.

3. Currently (June 2025), the knowledge base used by Radon AI contains only documentation files. While some documentation pages contain code snippets, we do not index the full source code of the libraries. For this reason, the React Native code generated by Radon AI may not be accurate.

4. GitHub Copilot Free is limited to 50 chat messages per month. When you reach this limit, you can upgrade to Copilot Pro to continue using Radon AI.

## Privacy

To provide accurate responses, queries that you type to Radon AI chatbot along with the list of your project dependencies are sent to our servers in order to search our knowledge database. The data that is sent is not stored in any form on our servers but only used for the duration of the request in order to perform the query.
