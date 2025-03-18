---
id: compatibility
title: Compatibility
sidebar_position: 6
---

import { Yes, No, Maybe, Version, Spacer } from "@site/src/components/Compatibility";

# Compatibility

This page lists different React Native application setups that are officially supported by the most recent version of Radon IDE.
If your setup is not included, it may still work or work with limited functionality.
In a such case, you can still Radon IDE but we also recommend [submitting an issue](https://github.com/software-mansion/radon-ide/issues/new/choose) describing your setup, such that we can improve compatibility and consider it as a setup that is officially supported.

## Supported editors

Radon IDE works with [Visual Studio Code](https://code.visualstudio.com/) 1.86 or higher and [Cursor](https://www.cursor.com/) 0.32 or higher.

## Supported project setups

The extension supports a wide variety of React Native and Expo setups. We rigorously test most popular ones and update the extension as new versions of React Native and Expo SDK appear. We constantly improve the range of compatible project structures and if project structure isn’t supported, feel free to [open an issue](https://github.com/software-mansion/radon-ide/issues/new/choose).

### Expo projects

Radon IDE supports Expo projects starting from Expo SDK 50.

<div className="compatibility">

|                 | Expo SDK 50 | Expo SDK 51 | Expo SDK 52 |
| --------------- | ----------- | ----------- | ----------- |
| Expo Dev Client | <Yes/>      | <Yes/>      | <Yes/>      |
| Expo Prebuild   | <Yes/>      | <Yes/>      | <Yes/>      |
| Expo Go         | <Yes/>      | <Yes/>      | <Yes/>      |

</div>

### React Native projects

Radon IDE supports projects bootstrapped with the [React Native Community CLI](https://github.com/react-native-community/cli) starting from React Native 0.73.

<div className="compatibility">

| 0.72  | 0.73   | 0.74   | 0.75   | 0.76   | 0.77   | 0.78   |
| ----- | ------ | ------ | ------ | ------ | ------ | ------ |
| <No/> | <Yes/> | <Yes/> | <Yes/> | <Yes/> | <Yes/> | <Yes/> |

</div>

### Monorepo projects

If your project doesn't work out-of-the-box because of modifications made in the setup, the Radon IDE might still support these modifications. See the [Configuring the IDE](/docs/guides/configuration) guide on how to adjust the Radon IDE to your project setup.

<div className="compatibility">

| Nx     | yarn workspaces | npm workspaces | pnpm workspaces |
| ------ | --------------- | -------------- | --------------- |
| <Yes/> | <Yes/>          | <No/>          | <Yes/>           |

</div>

We constantly improve the range of supported monorepo project structures. If you want to help us support your setup – [submit an issue](https://github.com/software-mansion/radon-ide/issues/new/choose).

### Brownfield projects

Brownfield applications are applications built using different technology with an integrated React Native app. Usually it's an existing iOS or Android native projects with some parts of it written in React Native.

Due to the complexity and a non-standard nature of the brownfield development these project setups aren't supported.

## Supported operating systems

<div className="compatibility">

|         | iOS    | Android                  |
| ------- | ------ | ------------------------ |
| macOS   | <Yes/> | <Yes/>                   |
| Linux   | <No/>  | <Maybe label="In Beta"/> |
| Windows | <No/>  | <Maybe label="In Beta"/> |

</div>
You can use Radon IDE on Windows and Linux using free Beta license.
<br/>
<br/>
