## React Native IDE User's guide

After [INSTALLING](INSTALLATION.md) the extension, you should be able to start using the extension by opening your React Native or Expo project as a workspace in Visual Studio Code.
If that's not the case and you have problems getting the extension to run, please check [TROUBLESHOOTING](TROUBLESHOOTING.md) guide.

For a quick overview of the features the IDE provides, you can check [React Native IDE website](https://ide.swmansion.com).

### 1. Open your project in vscode and start the extension panel

If your project setup is supported, there is no extra configuration that's necessary to get the project running.
The only thing you need to do is open your React Native of Expo project as workspace in vscode (File > Open Folder... option or using `code` command with the folder name from terminal).
Once you have it open, you can start the extension panel in one of a few ways:

1. When you open any file of your project to edit it, you can launch the extension from "Opne IDE Panel" button in the editor toolbar:

2. You can use "React Native IDE: Open IDE Panel" available in vscode's command palette:

3. If you already had the panel open in this project before restarting the editor, it will automatically reopen in the same place.

### 2. Create simulator and emulator instances on the first run

When you open the IDE panel for the first time, it'll ask you to configure Android emulator of iOS simulator.
Depending on which platform you want to run your app on first, click one of the options available at the initial screen:

You will be able to add or remove simulators later using the device menu in the left bottom corner of the panel.

In case the IDE cannot locate system images to use for the device, you will see an empty list when creating new emulator or simulator.
Please follow the [SIMULATORS](SIMULATORS.md) section to learn how to manage system versions of Android emulators or iOS simulators that the IDE can use.

### 3. Wait for the project to build and run

After all the above steps, you should now be able to see your app building and launching in the extension device preview.
From there, you can use the simulator normally.
