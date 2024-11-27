---
id: compatibility
title: Compatibility
sidebar_position: 6
---

import { Yes, No, Maybe, Version, Spacer } from "@site/src/components/Compatibility";

# Compatibility

The following compatibility page assumes you are using the newest version of Radon IDE.

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

| 0.72  | 0.73   | 0.74   | 0.75   | 0.76   |
| ----- | ------ | ------ | ------ | ------ |
| <No/> | <Yes/> | <Yes/> | <Yes/> | <Yes/> |

</div>

### Monorepo projects

If your project doesn't work out-of-the-box because of modifications made in the setup, the Radon IDE might still support these modifications. See the [Configuring the IDE](/docs/guides/configuration) guide on how to adjust the Radon IDE to your project setup.

<div className="compatibility">

| Nx     | yarn workspaces | npm workspaces | pnpm workspaces |
| ------ | --------------- | -------------- | --------------- |
| <Yes/> | <Yes/>          | <No/>          | <No/>           |

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
| Windows | <No/>  | <Maybe label="In Beta"/> |
| Linux   | <No/>  | <No/>                    |

</div>
You can use Radon IDE on Windows using free Beta license.
<br/>
<br/>

While running Radon IDE on Linux is technically possible, we do not have enough development capacity to add it.
If you want to contribute the support for Linux please consult [this issue](https://github.com/software-mansion/radon-ide/issues/688).
