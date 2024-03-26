## Repository structure and project architecture

React Native IDE consis of a number of modules we are outlining below.
It is useful to understand this architecture a bit more before contributing, so that it is cleaner which module is responsible for what part of the funtionality:

1. Main vscode extension code – this is the entry point for the extension that is booted up in a separate process by vscode. The code resides under `packages/vscode-extension` with the main entry point being `packages/vscode-extension/src/extension.ts` file. The extension code is responsible for orchestrating all actions with external process such as launchig builds, as well as handling communication between the frontend and vscode APIs.
2. Extension frontend – this is a web application written in React. Since it shares some code with the main extension it resides in the same location – `packages/vscode-extension`, but most of its code is located under `packages/vscode-extension/src/webview`. Vscode launches the frontend portion using iframe, wich enforces some limitations on what the frontend app can do (i.e. can't launch external processes directly). For this reason, most of the logic relies on calling to the main extension.
3. Simulator server – this code lives [in a separate repository](https://github.com/software-mansion-labs/simulator-server) which isn't open source yet. It implements a server application that communicates with iOS simulator and Android emulator processes. The server is controlled from the main extension code which communicates with it via standard input/output. Currently simulator server is distributed as prebuilt binary.
4. NPM package react-native-ide – this package defines interface for the preview functionality which allows for components to be developed in isolation. Its code is placed under `packages/react-native-ide`.
5. Test applications from `test-apps` folder serve a purpose of verifying the IDE works properly under different setups.

## Development setup

In order to run the extension in development mode, follow the steps below:

### 1. Clone the repository

```sh
git clone git@github.com:software-mansion-labs/react-native-ide.git
```

### 2. Install NPM dependencies in `packages/vscode-extension` folder

Inside `packages/vscode-extension` run:

```sh
npm install
```

### 3. Prepare simulator server build

Simulator server repository is not open sourced but we have a pre-build binaries published on the GitHub releases page.
First, you need to navigate to the [releases page on GitHub](https://github.com/software-mansion-labs/react-native-ide/releases), open the recent release, and download the sim-server file from "Assets" section (the filename contains a git hash for build consistency):

<img width="825" alt="download-sim-server" src="https://github.com/software-mansion-labs/react-native-ide/assets/726445/1b85280f-af22-49f2-9831-cf9d6321c9fc">


Next, place the downloaded file under `packages/vscode-extension/dist`.

Finally, run the following script inside `packages/vscode-extension` directory:

```sh
npm run build:sim-server-debug
```

In case of any errors, please read the output of this command before proceeding.

### 4. Open extension project in Visual Studio Code

It is necessary that you open that exact folder rather than the whole repository, as it contains project specific run configuration for launching the extension in development mode.
You can do it by opening new window in Visual Studio Code and using `File > Open Folder` option, then select `packages/vscode-extension`, or if you have vscode's command line tool installed you can open it using command:

```sh
code package/vscode-extension`
```

### 5. Launch vscode development host with development version of the extension

This can only be done from withing Visual Studio Code.
With the extension project open, go to `Run and Debug` panel and click "Start Debugging" button next to "Run Extension" configuration:

<img width="373" alt="run-and-debug" src="https://github.com/software-mansion-labs/react-native-ide/assets/726445/2907a3a2-682d-4ae2-8820-55fa5d3a7db4">

Running this configration will result in the new vscode window being opened.
This new window is titled "[Extension Development Host]" and is the only window that has the development version of the extension loaded – you should use it to open you React Native project, or try some of the test apps from `test-app` folder.

<img width="896" alt="extension-host-title" src="https://github.com/software-mansion-labs/react-native-ide/assets/726445/f64efd0e-4611-4742-8012-9f6dfbf484ca">

### 6. Develop the extension!

Frontend code is setup with hot reload, so changes made to frontend code will update live.

Code changes made to the main extension, requires restarting the extension project which will result in the Extension Host window reloading.
You can use Debug Tool Bar to restart the project:

<img width="438" alt="restart-extension" src="https://github.com/software-mansion-labs/react-native-ide/assets/726445/1cb5abb1-9516-48a1-8089-8ed4fbf60c16">

For main extension code, you can set breakpoints in vscode and use debugger normally, logs will appear in the Debug Console panel.
Unfortunately debugging isn't available for the frontend code, however you can use vscode's builtin chrome devtools to see logs or interact with the frontend portion of the project – for this you'll need to run command "Developer: Open Webview Developer Tools" from the command palette in the Extension Host window.
