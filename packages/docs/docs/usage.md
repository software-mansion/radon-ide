---
id: usage
title: Usage
sidebar_position: 3
---

After [installing](./installation.md) the extension, you should be able to start using the extension by opening your React Native or Expo project as a workspace in Visual Studio Code.
If that's not the case and you have problems getting the extension to run, please check [troubleshooting](./troubleshooting.md) guide.

For a quick overview of the features the IDE provides, you can check [React Native IDE website](https://ide.swmansion.com).

## -sec-num- Open your project in vscode and start the extension panel

If your project setup is supported, there is no extra configuration that's necessary to get the project running.
The only thing you need to do is open your React Native of Expo project as workspace in vscode (File > Open Folder... option or using `code` command with the folder name from terminal).
Once you have it open, you can start the extension panel in one of a few ways:

1. When you open any file of your project to edit it, you can launch the extension from "Open IDE Panel" button in the editor toolbar:
   <img width="800" alt="sztudio_editor_button" src="/img/docs/sztudio_editor_button.png"/>
2. You can use "React Native IDE: Open IDE Panel" available in vscode's command palette:
   <img width="800" alt="sztudio_command_palette" src="/img/docs/sztudio_command_palette.png"/>
3. If you already had the panel open in this project before restarting the editor, it will automatically reopen in the same place.

## -sec-num- Create simulator and emulator instances on the first run

When you open the IDE panel for the first time, it'll ask you to configure Android emulator of iOS simulator.
Depending on which platform you want to run your app on first, click one of the options available at the initial screen:

<img width="650" alt="sztudio-init-screen" src="/img/docs/sztudio_init_screen.png"/>

You will be able to add or remove simulators later using the device menu in the left bottom corner of the panel.

In case the IDE cannot locate system images to use for the device, you will see an empty list when creating new emulator or simulator.
Please follow the [simulators](./simulators.md) section to learn how to manage system versions of Android emulators or iOS simulators that the IDE can use.

## -sec-num- Decide on the location of the IDE panel

The main extension window can be either presented as one of the editor tabs, which is the default behavior, or as a side panel (in primary or secondary side panel location).
To change between these modes, you can either use React Native IDE section in the VSCode settings, or use the dropdown menu from the right top corner in the IDE panel:

<img width="450" alt="sztudio-change-position" src="/img/docs/sztudio_change_position.png"/>

Here is how the IDE would look like when place in the side panel:

<img width="800" alt="sztudio-side-panel" src="/img/docs/sztudio_side_panel.png"/>

## -sec-num- Wait for the project to build and run

After all the above steps, you should be able to see your app building and launching in the extension device preview.
From there, you can use the simulator normally to navigate in your app and try out some of the developer experience enhancements that the IDE provides.

## -sec-num- IDE featuers highlights

Visit [React Native IDE](https://ide.swmansion.com/) webside, for a nicely presented list of the feature highlights.

### Click to inspect

Using the built-in inspector you can jump directly from preview to a file where your component is defined.

<video autoPlay loop width="500" controls>

  <source src="/video/2_sztudio_inspect.mp4" type="video/mp4"/>
</video>

### Use breakpoints right in VSCode

Without any additional setup the extension allows to add a breakpoints in Visual Studio Code to debug your React Native application.
IDE also automatically stops at runtime exceptions showing you the exact line of code where they happened.

<video autoPlay loop width="500" controls>
  <source src="/video/3_sztudio_debugger.mp4" type="video/mp4"/>
</video>

### URL bar (currently supports expo-router only)

The React Native IDE integrates with your deep-linked application allowing you to jump around the navigation structure.

<video autoPlay loop width="500" controls>
  <source src="/video/4_sztudio_url_bar.mp4" type="video/mp4"/>
</video>

### Logs integration

React Native IDE uses the built-in VSCode console allowing you to filter through the logs.
The links displayed in the console are automatically linking back to your source code.

<video autoPlay loop width="500" controls>
  <source src="/video/5_sztudio_logs_panel.mp4" type="video/mp4"/>
</video>

### Develop components in isolation

Develop your components individually without distractions.

Install `react-native-ide` package and use `preview` method from it to define the components that should render in preview mode:

```js
import { preview } from "react-native-ide";

preview(<MyComponent param={42} />);
```

The extension will display a clickable "Open preview" button over the line with `preview` call that you can use to launch into the preview mode.

<video autoPlay loop width="500" controls>
  <source src="/video/6_sztudio_preview.mp4" type="video/mp4"/>
</video>

### Adjust device settings on the fly

You can adjust text size and light/dark mode right from the React Native IDE.
Focus just on your app without switching between windows.

<video autoPlay loop width="500" controls>
  <source src="/video/7_sztudio_device_settings.mp4" type="video/mp4"/>
</video>
