---
id: launching
title: Launching the IDE
sidebar_position: 3
---

After [installing](./installation) the extension, you should be able to start using the extension by opening your React Native or Expo project as a workspace in Visual Studio Code.
If that's not the case and you have problems getting the extension to run, please check [troubleshooting](./troubleshooting.md) guide.

For a quick overview of the features the IDE provides, you can check [Radon IDE website](https://ide.swmansion.com).

## -sec-num- Open your project in vscode and start the extension panel

If your project setup is supported, there is no extra configuration that's necessary to get the project running.
The only thing you need to do is open your React Native of Expo project as workspace in vscode (File > Open Folder... option or using `code` command with the folder name from terminal).
Once you have it open, you can start the extension panel in one of a few ways:

1. When you open any file of your project to edit it, you can launch the extension from `Open IDE Panel` button in the editor toolbar:
   <img width="800" alt="sztudio_editor_button" src="/img/docs/sztudio_editor_button.png"/>
2. You can use "Radon IDE: Open IDE Panel" available in vscode's command palette:
   <img width="800" alt="sztudio_command_palette" src="/img/docs/sztudio_command_palette.png"/>
3. If you already had the panel open in this project before restarting the editor, it will automatically reopen in the same place.

## -sec-num- Create simulator and emulator instances on the first run

When you open the IDE panel for the first time, it'll ask you to configure Android emulator or iOS simulator.
Depending on which platform you want to run your app on first, click one of the options available at the initial screen:

<img width="650" alt="sztudio-init-screen" src="/img/docs/sztudio_init_screen.png"/>

You will be able to add or remove simulators later using the device menu in the left bottom corner of the panel.

In case the IDE cannot locate system images to use for the device, you will see an empty list when creating new emulator or simulator.
Please follow the [simulators](./simulators.md) section to learn how to manage system versions of Android emulators or iOS simulators that the IDE can use.

## -sec-num- Decide on the location of the IDE panel

The main extension window can be either presented as one of the editor tabs, which is the default behavior, or as a side panel (in primary or secondary side panel location).
To change between these modes, you can either use Radon IDE section in the VSCode settings, or use the dropdown menu from the right top corner in the IDE panel:

<img width="450" alt="sztudio-change-position" src="/img/docs/sztudio_change_position.png"/>

Here is how the IDE would look like when place in the side panel:

<img width="800" alt="sztudio-side-panel" src="/img/docs/sztudio_side_panel.png"/>

## -sec-num- Wait for the project to build and run

After all the above steps, you should be able to see your app building and launching in the extension device preview.
From there, you can use the simulator normally to navigate in your app and try out some of the developer experience enhancements that the IDE provides.
