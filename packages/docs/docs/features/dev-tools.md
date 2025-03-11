---
id: dev-tools
title: Dev Tools
sidebar_position: 7
---

Radon IDE comes with support for launching Dev Tools as separate panels withing VSCode or Cursor.

The built-in tools for Network Inspector, Redux, Outline Rerenders (via [react-scan](https://react-scan.com/)) and React Query are integrated with the IDE and doesn't require any additional configuration.

> NOTE: If your app uses [Expo Devtools Plugins](https://docs.expo.dev/debugging/devtools-plugins/) you will be able to use the Redux and React Query dev tools via the plugin too. However, we recommend using the tools that are built into the Radon IDE instead of the ones from the plugins as Radon relies on the official dev extension for Redux and React Query respectively.

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

## React Query

This plugin doesn't require any additional configuration.
When the IDE detects your app uses React Query, the plugin will be listed in the Dev Tools menu.
Once enabled you can use the official [React Query's devtool UI](https://tanstack.com/query/v4/docs/framework/react/devtools) from within the editor panel:

<img width="700" src="/img/docs/ide_devtools_react_query.png" className="shadow-image" />

## CPU Profiling JavaScript

Radon IDE integrates with the hermes sampling CPU profiler.
When you app uses the supported version of hermes and devtools, the option to start profiling will appear in the Dev Tools menu.
Once profiling is started a button will appear next to the navigation bar in the IDE indicating the profiling is in progress.
You can use the button at the end of the profiling session to trigger a save dialog of the profiling output.
Once you save the profiling file, the IDE will automatically open the saved profile and use the built-in [Profile Visualizer](https://github.com/microsoft/vscode-js-profile-visualizer) plugin to display a profile.

<img width="550" src="/img/docs/ide_devtools_profiler_stop.png" className="shadow-image" />

When profile is saved, Radon IDE resolves the source location of the methods captured during profiling session, such that you can navigate to code directly from the profile visualizer tool.

<img width="700" src="/img/docs/ide_devtools_profiler_visualize.png" className="shadow-image" />

> NOTE: In order to view the profile in flame chart view, you need to install official [Flame Chart Visualizer](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-js-profile-flame) extension. Once the profile is saved, Radon IDE will display a message with direct installation link for this extension.

When profiling, remember that the app you profile is the development build of your application running in a simulator environment.
Development builds typically come with a significant overhead of extra work that is only done to provide better error reporting and traceability of errors.
Hence the performance may significantly differ compared to the production builds running on an actual phone.

## Outline Renders (react-scan)

Radon IDE integrates with [react-scan](https://react-scan.com) and enables a subset of its functionality.
For now, only the visualization of React renders is integrated.
You can enable this option by selecting "Outline Renders" from the Dev Tools menu.
Once enabled, the IDE will visualize React renders happening within the app.

> NOTE: Unlike with other dev tools, this setting turns off automatically when you close the editor or the Radon IDE panel.

<img width="700" src="/img/docs/ide_devtools_react_scan.png" className="shadow-image" />

## Redux (via Expo Devtools Plugin)

We recommend you use the built-in Redux dev tool as described in the above section which requires no extra setup.
However, if your workflow relies on using Expo CLI and you need to have the [Expo Redux Devtool Plugin](https://docs.expo.dev/debugging/devtools-plugins/#redux) setup in your project, Radon IDE will automatically detect it and will use the Redux devtools via the installed plugin.

<img width="700" src="/img/docs/ide_devtools_expo_redux.png" className="shadow-image" />

## React Query (via Expo Devtools Plugin)

We recommend you use the built-in React Query tool as described in one of the previous sections as it provides the official UI for React Query that is much more powerful than the one build for the Expo Plugin.
For legacy reasons however, Radon IDE still supports the Expo Devtool Plugin for React Query.
In order to use it, you need to install and configure the plugin by following the instructions from [React Query Expo Devtool Plugin website](https://docs.expo.dev/debugging/devtools-plugins/#react-query).

<img width="700" src="/img/docs/ide_devtools_expo_reactquery.png" className="shadow-image" />

## More tools

We are constantly working on adding more tools to Radon IDE.
If there are existing tools that you find particularily useful, please [open an issue to let us know](https://github.com/software-mansion/radon-ide/issues).
