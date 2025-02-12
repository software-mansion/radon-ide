---
id: dev-tools
title: Dev Tools (experimental)
sidebar_position: 7
---

Radon IDE comes with an experimental support for launching Dev Tools as separate panels withing VSCode or Cursor.

Currently, only a limited set of tools is available.
The Network Inspector and Redux tools are built into the Radon IDE and don't require any additional configuration.
The remaining tools rely on the [Expo Devtools Plugins](https://docs.expo.dev/debugging/devtools-plugins/) being setup for these individual tools to work (wee instructions below).

When the IDE detects that a specific tool is available and configured properly (see below for details on configuring individual tools), it will be listed in the tools menu where you can turn it on and off:
<img width="350" src="/img/docs/ide_devtools_menu.png" className="shadow-image" />

When the tool is enabled in your project, you will get a new panel opened in VSCode:
<img width="700" src="/img/docs/ide_devtools_panel.png" className="shadow-image" />

There will be a separate panel for each individual tool.
You can quickly navigate to the panel from the tools menu by using the "link" icon next to the tool name:
<img width="350" src="/img/docs/ide_devtools_menu_icon.png" className="shadow-image" />

Tool on/off setting is persisted locally for the scope of your project (VSCode or Cursor workspace).
Therefore when you open the project next time in the IDE, the tool panel will launch automatically.
It will also be kept open when you switch between different devices across that project.

## Network Inspector

This panel doesn't require any additional configuration and should be available as soon as your app is launched.
Network panel will capture and list all requests triggered by the JavaScript code (with HXR / fetch or wrappers like Axios/Apollo etc).
Images or websocket connections aren't currently supported and won't show up.

<img width="700" src="/img/docs/ide_devtools_network_inspector.png" className="shadow-image" />

## Redux

This plugin doesn't require any additional configuration.
If your app uses Redux, the IDE will automatically detect that, and Redux plugin will be listed in the Dev Tools menu where you can enable it.
Once enabled you will be able to use the official Redux UI (same one as the Redux Chrome extension) from within your editor panel:

<img width="700" src="/img/docs/ide_devtools_redux.png" className="shadow-image" />

## Redux (via Expo Devtools Plugin)

We recommend you use the built-in Redux dev tool as described in the above section which requires no extra setup.
However, if your workflow relies on using Expo CLI and you need to have the [Expo Redux Devtool Plugin](https://docs.expo.dev/debugging/devtools-plugins/#redux) setup in your project, Radon IDE will automatically detect it and will use the Redux devtools via the installed plugin.
There should be no difference in functionality with either of these options, so it is only a matter of convinience.

<img width="700" src="/img/docs/ide_devtools_expo_redux.png" className="shadow-image" />

## React Query (via Expo Devtools Plugin)

React Query plugin only works when installed and configured via the Expo Plugin.
Follow the setup instructions from [React Query Expo Devtool Plugin website](https://docs.expo.dev/debugging/devtools-plugins/#react-query).

<img width="700" src="/img/docs/ide_devtools_expo_reactquery.png" className="shadow-image" />

## More tools

We are constantly working on adding more tools to Radon IDE.
If there are existing tools that you find particularily useful, please [open an issue to let us know](https://github.com/software-mansion/radon-ide/issues).
