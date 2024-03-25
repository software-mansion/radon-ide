## Installing the extension for Private Beta members

In the private beta phase, we decided not to publish the extension on the marketplace.
The vscode marketplace is going to be the main way for us to distribute the extension eventually, but for the time being we will only publish the pre-build versions of the extension using GitHub releases.

If you wish to build the extension from source in order to make modifications, head to the [DEVELOPMENT](DEVELOPMENT.md) instructions instead.

## 1. Download VSIX file from releases page

Navigate to the [releases page on GitHub](https://github.com/software-mansion-labs/react-native-ide/releases) and select the most recent release.
From the "Assets" section, download the `.vsix` file:

<img width="825" alt="download-vsix" src="https://github.com/software-mansion-labs/react-native-ide/assets/726445/05f41079-9d1d-430b-a178-5c0661890687">


## 2. Install VSIX in vscode

Open Visual Studio Code to install the downloaded extension package.
You can [follow this official vscode guide on installing VSIX extension] to see all the possible ways how this can be handled, or navigate to extension panel and click "Install from VSIX" option that's placed under "···" button in the top right corner, then select the downloaded file.

<img width="609" alt="install-from-vsix" src="https://github.com/software-mansion-labs/react-native-ide/assets/726445/1d648637-e87a-4387-ba64-8fe7ab5b6148">


## Updating

When installing updates, you should follow the same exact procedure and the new version will be installed over the previous one (you can also downgrade to some older version this way).
When overinstalling new VSIX file, you'll be prompted with a dialog to reload vscode window, which you need to accept before the new version is loaded.
