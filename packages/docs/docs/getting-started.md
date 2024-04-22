---
id: getting-started
title: Getting started
sidebar_position: 1
---

# Getting started

## Welcome to React Native IDE Private Beta 🎉

React Native IDE is not a ready product (yet).
We are hoping that together with the community we will be able to get there soon.
We are thankful that you decided to join the beta program and help us improve this tool.

### 🚧 Who can use this

React Native IDE currently supports some subset of React Native projects due to a number of different setup options.
We constantly work to improve this compatibility, and in case your project structure isn’t supported, feel free to open an issue.
Below we list high-level requirements for the projects we support at the moment:

- With React Native IDE you can only run iOS and Android applications. If your project supports other platforms, you should be able to use the IDE but only for launching the Android and iOS part of your project.
- We support only recent version of React Native (0.71 onwards) as well as Expo SDK 49+
- Brownfield-type projects are currently not supported (projects that are primarily native apps with React Native used on some screens)
- Expo Go projects aren't currently supported

As a general rule of thumb, if your projects started from Expo template or React Native community CLI template, and hasn’t diverged much in terms of build configuration, meaning that you can still run it using expo or react native CLI without additional steps, it should work with React Native IDE.

### ✨ What does it do

React Native IDE is a vscode extension that aims to streamline development of React Native and Expo applications.
The current version supports developing for Android and iOS platforms with the current list of features available:

- Managing iOS and Android simulator (for now only iPhone Pro and Pixel 7 skins are available)
- Automatically build and launch your project (keeping track of native or javascript updates automatically)
- Integrated debugger always available – when running the project you can set breakpoints in the editor and don't need to bother with any additional configuration to get your application stop at those breakpoints
- Element inspector that jumps to component code
- Integrated console log output panel that links to file/line with the log statement
- Preview package that allows for working on components in isolation (render single component instead of the whole app)
- Expo Router integration with browser-like URL toolbar
- Easy access to device settings for text size and light/dark mode

### 💽 Installation

For installation instructions head to [installation](./installation.md) section.

### 💻 Usage

See [usage](./usage.md) guide on how to get started after installing the extension. You can also visit [React Native IDE](https://ide.swmansion.com) website where we hilight the most important features.

### 🐛 Troubleshooting

For troubleshooting and guide on reporting issues head to [troubleshooting](./troubleshooting.md) section.

### ⚒️ Extension Development

If you want to develop the extension and contribute updates head to [development](./development.md) section.

## Discord

Make sure to join [Software Mansion](https://swmansion.com) Discord channel using invite link: https://discord.gg/jWhHbxQsPd and contact us to get added to `react-native-ide-beta` channel where we discuss issues and communicate our plans and updates.
