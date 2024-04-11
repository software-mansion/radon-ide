---
id: simulators
title: Simulators
sidebar_position: 4
---

## Managing System Images for Simulators and Emulators

While the IDE can manage simulator and emulator instances, it requires that the right version of system images is installed on your computer.

In case when no supported image is installed, you won't be able to create new simulator or emulator using the IDE.
Please follow below sections to learn how to install and manage system versions for Android emulators and iOS simulators.

### Installing Android images

1. Open Android Studio and launch SDK Manager from "Tools" menu.
2. Lookup Android version of your choice and install one of available system images. You can use "Show Package Details" checkbox to see full list of options. It is important that you select System Image that's right for your processor (for M1/2/3 Macs select ARM 64 image, or Intel for older generations of Macs). We recommend selecting Google Play-enabled images, but this choice doesn't impact the way the extension works.
3. Select and install the right image.
   <img width="800" alt="android-sdk-manager" src="https://github.com/software-mansion/react-native-ide/assets/726445/8c078f77-1b72-477d-b4d3-dcb0b48e5851"/>

### Installing iOS platforms

1. Open Xcode and launch settings dialog from Xcode > Settings menu
2. Go to "Platforms" tab:
   <img width="800" alt="ios-platforms-manager" src="https://github.com/software-mansion/react-native-ide/assets/726445/edb89317-78cf-48c9-a915-c03006f8b5ca"/>

3. Use "+" button in bottom left corner, select "iOS" from the menu and find the iOS version you want to install from the list:
   <img width="800" alt="ios-platforms-manager-select-version" src="https://github.com/software-mansion/react-native-ide/assets/726445/b6cc64a8-bca7-42a3-88cd-13ef458441bb"/>

4. Click "Download & install" button to begin installing
