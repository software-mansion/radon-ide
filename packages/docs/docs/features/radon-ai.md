---
id: radon-ai
title: Radon AI
sidebar_position: 11
---

Radon AI is a MCP server that provides a set of tools that enhances your editor’s Agent.
It provides up-to-date knowledge of the React Native ecosystem, access to a comprehensive set of debugging data that is otherwise unavailable, and the ability to interact directly with your app.

We index most of the React Native libraries along with their relevant documentation, versions, APIs, configuration details, and usage patterns to provide additional and accurate context for your Agents.

Our knowledge database is updated daily to provide the most up-to-date information.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/radon_ai_query_database.mp4" type="video/mp4"/>
</video>

## Pre-requisites

- Cursor Editor or Visual Studio Code 1.99 or newer
- In Visual Studio Code: Access to [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) and [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat). GitHub Copilot Chat comes with a [GitHub Copilot Free](https://docs.github.com/en/copilot/managing-copilot/managing-copilot-as-an-individual-subscriber/managing-copilot-free/about-github-copilot-free) without needing to sign up for another subscription.
- An active [Radon IDE license](/docs/guides/activation-manual)

## Usage in Visual Studio Code

Radon AI assistant integrates with VSCode's `agent mode`.

To access `agent mode` in Visual Studio Code use `Ctrl + Shift + I` or `Cmd + Shift + I`.

Alternatively, open VSCode Command Palette (`Ctrl + Shift + P` or `Cmd + Shift + P`) and type `Chat: Open Chat`, then select `agent mode`.

<img width="550" src="/img/docs/ai_vscode_agent_mode.png" className="shadow-image"/>

To adjust the configuration of the MCP tools exposed by Radon - choose `Configure Tools...` menu.

<img width="550" src="/img/docs/ai_vscode_choose_tools.png" className="shadow-image"/>

There you can adjust which tools are enabled or disable the Radon AI MCP toolset completely.

<img width="600" src="/img/docs/ai_vscode_mcp_tools.png" className="shadow-image"/>

## Usage in Cursor

Radon AI assistant integrates with Cursor's `agent mode`.

<img width="550" src="/img/docs/ai_cursor_chat_response.png" className="shadow-image"/>

The Radon IDE automatically registers Radon AI tools in Cursor.
You configure the Radon AI MCP tools from Cursor Settings. There, you can choose which tools are enabled or disable the MCP Radon toolset completely.

1. In Cursor, open `Cursor Settings` (`Ctrl + Shift + J` or `Cmd + Shift + J`).
2. Navigate to the `Tools & Integrations`.
3. Find the `MCP Tools` section.
4. Select `Radon AI` from the list of available toolsets.

<img width="550" src="/img/docs/ai_cursor_mcp_settings.png" className="shadow-image"/>

Alternatively, you can type and run `View: Open MCP Settings` from the Command Palette (`Ctrl + Shift + P` or `Cmd + Shift + P`).

## Available tools

The AI models automatically discover and invoke tools when they decide it will be useful. You can query the agent to use the tool by mentioning it's name in the prompt. These are currently available tools in Radon AI:

- `get_library_description` Provides a detailed description of a library and its use cases.
- `query_documentation` Retrieves documentation snippets relevant to a provided query.
- `reload_application` Triggers reload of the application. The AI may choose whether to restart the application process, reload just the JS bundle, or rebuild the entire app.
- `view_application_logs` Returns all the build, bundling and runtime logs available to Radon IDE. If the app builds and launches successfully, this tool will also attach a screenshot of the app.
- `view_screenshot` Captures a device preview screenshot. Can help the agent with debugging issues and making UI adjustments. Currently only supported in GPT, Gemini and Claude models.
- `view_component_tree` Displays the component tree of the running app. This tool allows the agent to gain a broad understanding of the project's structure.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/radon_ai_preview.mp4" type="video/mp4"/>
</video>

## Limitations

1. Like any technology based on large language models, responses augmented by Radon AI are still prone to errors. Make sure to check important information before making decisions.

2. The knowledge base used by Radon AI contains only documentation files. While some documentation pages contain code snippets, we do not index the full source code of the libraries.

3. Both GitHub Copilot and Cursor offer limited free plans that allow you to try Radon AI. Once you reach certain limits, you will need to upgrade to paid plans to continue using Radon AI.

## Disabling Radon AI

To disable Radon AI assistant navigate to the editor settings.

You can type `Preferences: Open User Settings` in the Command Palette (`Ctrl + Shift + P` or `Cmd + Shift + P`).

Within editor settings, type `Radon AI: Enabled`, press the first result and select `Disabled`.

## Privacy

To provide accurate responses, queries that you type to Radon AI chatbot along with the list of your project dependencies are sent to our servers in order to search our knowledge database. The data that is sent is not stored in any form on our servers but only used for the duration of the request in order to perform the query.
