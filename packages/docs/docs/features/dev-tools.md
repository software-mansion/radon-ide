---
id: dev-tools
title: Dev Tools (experimental)
sidebar_position: 7
---

Radon IDE 1.2 comes with an experimental support for launching Dev Tools as separate panels withing VSCode or Cursor.

Currently, only limited set of tools is available, and the existing ones only integrate with the [Expo Devtools Plugins](https://docs.expo.dev/debugging/devtools-plugins/) and therefore require Expo Devtools Plugins to be setup for each individual tool to work.

When the IDE detects that a certain tool is available and configured properly (see below for details on configuring individual tools), it will be listed in the tools menu where you can turn it on and off:
<img width="350" src="/img/docs/ide_devtools_menu.png" className="shadow-image" />

When the tool is enabled in your project, you will get a new panel opened in VSCode:
<img width="700" src="/img/docs/ide_devtools_panel.png" className="shadow-image" />

There will be a separate panel for each individual tool.
You can quickly navigate to the panel from the tools menu by using the "link" icon next to the tool name:
<img width="350" src="/img/docs/ide_devtools_menu_icon.png" className="shadow-image" />

Tool on/off setting is persisted locally for the scope of your project (VSCode or Cursor workspace).
Therefore when you open the project next time in the IDE, the tool panel will launch automatically.
It will also be kept open when you switch between different devices across that project.

## Redux (via Expo Devtools Plugin)

In order to set it up, follow the instructions from [this Expo guide on Redux Devtool Plugin](https://docs.expo.dev/debugging/devtools-plugins/#redux).

<img width="700" src="/img/docs/ide_devtools_expo_redux.png" className="shadow-image" />

## React Query (via Expo Devtools Plugin)

Follow the setup instructions from [React Query Expo Devtool Plugin website](https://docs.expo.dev/debugging/devtools-plugins/#react-query).

<img width="700" src="/img/docs/ide_devtools_expo_reactquery.png" className="shadow-image" />

## More tools

We are constantly working on adding more tools to Radon IDE.
If there are existing tools that you find particularily useful, please [open an issue to let us know](https://github.com/software-mansion/radon-ide/issues).
