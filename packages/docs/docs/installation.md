---
id: installation
title: Installation
sidebar_position: 2
---

## Installing the extension for Private Beta members

In the private beta phase, we decided not to publish the extension on the marketplace.
The vscode marketplace is going to be the main way for us to distribute the extension eventually, but for the time being we will only publish the pre-build versions of the extension using GitHub releases.

If you wish to build the extension from source in order to make modifications, head to the [development](./development.md) instructions instead.

## -sec-num- Download VSIX file from releases page

Navigate to the [releases page on GitHub](https://github.com/software-mansion/react-native-ide/releases) and select the most recent release.
From the "Assets" section, download the `.vsix` file:

<img width="825" alt="download-vsix" src="/img/docs/download_vsix.png"/>

## -sec-num- Install VSIX in VS Code (for Cursor see next step)

Open VS Code to install the downloaded extension package.
You can [follow this official vscode guide on installing VSIX extension](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix) to see all the possible ways how this can be handled, or navigate to extension panel and click **_Install from VSIX_** option that's placed under **···** button in the top right corner, then select the downloaded file.

<img width="609" alt="install-from-vsix" src="/img/docs/install_from_vsix.png"/>

## 3. Installation for [Cursor](https://cursor.sh/) users

Since [Cursor](https://cursor.sh/) is a fork of VS Code, it supports extensions build for VS Code.
In order to install React Native IDE extension, you need to drag and drop the VSIX file onto the extension panel in Cursor:

<img width="300" src="/img/docs/ide_install_cursor.png"/>

## Updates

When installing updates, you should follow the same exact procedure and the new version will be installed over the previous one (you can also downgrade to some older version this way).
When installing over new VSIX file, you'll be prompted with a dialog to reload vscode window, which you need to accept before the new version is loaded.
