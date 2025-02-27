import path from "path";
import fs from "fs";
import WebSocket from "ws";
import { Disposable, ExtensionMode, Uri, workspace } from "vscode";
import stripAnsi from "strip-ansi";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { extensionContext, getAppRootFolder } from "../utilities/extensionContext";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import { Devtools } from "./devtools";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { EXPO_GO_BUNDLE_ID, EXPO_GO_PACKAGE_NAME } from "../builders/expoGo";
import { connectCDPAndEval } from "../utilities/connectCDPAndEval";

export interface MetroDelegate {
  onBundleError(): void;
  onIncrementalBundleError(message: string, errorModulePath: string): void;
}

interface CDPTargetDescription {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
  [key: string]: any; // To allow for any additional properties
}

type MetroEvent =
  | {
      type: "bundle_build_failed"; // related to bundleError status
    }
  | {
      type: "bundling_error"; // related to incrementalBundleError status
      message: string;
      stack: string;
      error: {
        message: string;
        originModulePath: string;
        targetModuleName: string;
        errors: {
          description: string;
        }[];
      };
    }
  | {
      type: "bundle_transform_progressed";
      transformedFileCount: number;
      totalFileCount: number;
    }
  | { type: "RNIDE_expo_env_prelude_lines"; lineCount: number }
  | {
      type: "RNIDE_initialize_done";
      port: number;
    }
  | {
      type: "RNIDE_watch_folders";
      watchFolders: string[];
    }
  | {
      type: "client_log";
      level: "error";
      data: [
        string, // message
        string, // bundle
        string, // todo: ensure what this field means
        string // todo: ensure what this field means
      ];
    };

export class Metro implements Disposable {
  private subprocess?: ChildProcess;
  private _port = 0;
  private _watchFolders: string[] | undefined = undefined;
  private startPromise: Promise<void> | undefined;
  private usesNewDebugger?: Boolean;
  private _expoPreludeLineCount = 0;

  constructor(private readonly devtools: Devtools, private readonly delegate: MetroDelegate) {}

  public get isUsingNewDebugger() {
    if (this.usesNewDebugger === undefined) {
      throw new Error("Debugger is not yet initialized. Call getDebuggerURL first.");
    }
    return this.usesNewDebugger;
  }

  public get port() {
    return this._port;
  }

  public get watchFolders() {
    if (this._watchFolders === undefined) {
      throw new Error("Attempting to read watchFolders before metro has started");
    }
    return this._watchFolders;
  }

  public get expoPreludeLineCount() {
    return this._expoPreludeLineCount;
  }

  public dispose() {
    this.subprocess?.kill(9);
  }

  public async ready() {
    if (!this.startPromise) {
      throw new Error("metro not started");
    }
    await this.startPromise;
  }

  public async start(
    resetCache: boolean,
    progressListener: (newStageProgress: number) => void,
    dependencies: Promise<any>[]
  ) {
    if (this.startPromise) {
      throw new Error("metro already started");
    }
    this.startPromise = this.startInternal(resetCache, progressListener, dependencies);
    this.startPromise.then(() => {
      // start promise is used to indicate that metro has started, however, sometimes
      // the metro process may exit, in which case we need to update the promise to
      // indicate an error.
      this.subprocess
        ?.catch(() => {
          // ignore the error, we are only interested in the process exit
        })
        ?.then(() => {
          this.startPromise = Promise.reject(new Error("Metro process exited"));
        });
    });
    return this.startPromise;
  }

  private launchExpoMetro(
    appRootFolder: string,
    libPath: string,
    resetCache: boolean,
    expoStartExtraArgs: string[] | undefined,
    metroEnv: typeof process.env
  ) {
    const args = [path.join(libPath, "expo_start.js")];
    if (resetCache) {
      args.push("--clear");
    }
    if (expoStartExtraArgs) {
      args.push(...expoStartExtraArgs);
    }

    return exec("node", args, {
      cwd: appRootFolder,
      env: metroEnv,
      buffer: false,
    });
  }

  private launchPackager(
    appRootFolder: string,
    libPath: string,
    resetCache: boolean,
    metroEnv: typeof process.env
  ) {
    const reactNativeRoot = path.dirname(
      require.resolve("react-native", { paths: [appRootFolder] })
    );
    return exec(
      "node",
      [
        path.join(reactNativeRoot, "cli.js"),
        "start",
        ...(resetCache ? ["--reset-cache"] : []),
        "--no-interactive",
        "--port",
        "0",
        "--config",
        path.join(libPath, "metro_config.js"),
        "--customLogReporterPath",
        path.join(libPath, "metro_reporter.js"),
      ],
      {
        cwd: appRootFolder,
        env: metroEnv,
        buffer: false,
      }
    );
  }

  public async startInternal(
    resetCache: boolean,
    progressListener: (newStageProgress: number) => void,
    dependencies: Promise<any>[]
  ) {
    const appRootFolder = getAppRootFolder();
    const launchConfiguration = getLaunchConfiguration();
    await Promise.all([this.devtools.ready()].concat(dependencies));

    const libPath = path.join(extensionContext.extensionPath, "lib");
    let metroConfigPath: string | undefined;
    if (launchConfiguration.metroConfigPath) {
      metroConfigPath = findCustomMetroConfig(launchConfiguration.metroConfigPath);
    }
    const isExtensionDev = extensionContext.extensionMode === ExtensionMode.Development;
    const metroEnv = {
      ...launchConfiguration.env,
      ...(metroConfigPath ? { RN_IDE_METRO_CONFIG_PATH: metroConfigPath } : {}),
      NODE_PATH: path.join(appRootFolder, "node_modules"),
      RCT_METRO_PORT: "0",
      RCT_DEVTOOLS_PORT: this.devtools.port.toString(),
      RADON_IDE_LIB_PATH: libPath,
      RADON_IDE_VERSION: extensionContext.extension.packageJSON.version,
      ...(isExtensionDev ? { RADON_IDE_DEV: "1" } : {}),
    };
    let bundlerProcess: ChildProcess;

    if (shouldUseExpoCLI()) {
      bundlerProcess = this.launchExpoMetro(
        appRootFolder,
        libPath,
        resetCache,
        launchConfiguration.expoStartArgs,
        metroEnv
      );
    } else {
      bundlerProcess = this.launchPackager(appRootFolder, libPath, resetCache, metroEnv);
    }
    this.subprocess = bundlerProcess;

    const initPromise = new Promise<void>((resolve, reject) => {
      // reject if process exits
      bundlerProcess
        .catch((reason) => {
          Logger.error("Metro exited unexpectedly", reason);
          reject(new Error(`Metro exited with code ${reason.exitCode}: ${reason.message}`));
        })
        .then(() => {
          // we expect metro to produce a line with the port number indicating it started
          // successfully. However, if it doesn't produce that line and exists, the promise
          // would be waiting indefinitely, so we reject it in that case as well.
          reject(new Error("Metro exited but did not start server successfully."));
        });

      lineReader(bundlerProcess).onLineRead((line) => {
        try {
          const event = JSON.parse(line) as MetroEvent;
          if (event.type === "bundle_transform_progressed") {
            // Because totalFileCount grows as bundle_transform progresses at the beginning there are a few logs that indicate 100% progress thats why we ignore them
            if (event.totalFileCount > 10) {
              progressListener(event.transformedFileCount / event.totalFileCount);
            }
          } else if (event.type === "client_log" && event.level === "error") {
            Logger.error(stripAnsi(event.data[0]));
          } else {
            Logger.debug("Metro", line);
          }

          switch (event.type) {
            case "RNIDE_expo_env_prelude_lines":
              this._expoPreludeLineCount = event.lineCount;
              Logger.debug("Expo prelude line offset was set to: ", this._expoPreludeLineCount);
              break;
            case "RNIDE_initialize_done":
              this._port = event.port;
              Logger.info(`Metro started on port ${this._port}`);
              resolve();
              break;
            case "RNIDE_watch_folders":
              this._watchFolders = event.watchFolders;
              Logger.info("Captured metro watch folders", this._watchFolders);
              break;
            case "bundle_build_failed":
              this.delegate.onBundleError();
              break;
            case "bundling_error":
              this.delegate.onIncrementalBundleError(event.message, event.error.originModulePath);
              break;
          }
        } catch (error) {
          // ignore parsing errors, just print out the line
          Logger.debug("Metro", line);
        }
      });
    });

    return initPromise;
  }

  private async sendMessageToDevice(method: "devMenu" | "reload") {
    // we use metro's /message websocket endpoint to deliver specifically formatted
    // messages to the device.
    // Metro implements a websocket proxy that proxies messages between connected
    // clients. This is a mechanism used by the CLI to deliver messages for things
    // like reload or open dev menu.
    // The message format is a JSON object with a "method" field that specifies
    // the action, and version field with the protocol version (currently 2).
    const ws = new WebSocket(`ws://localhost:${this._port}/message`);
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    ws.send(
      JSON.stringify({
        version: 2 /* protocol version, needs to be set to 2 */,
        method,
      })
    );
    // we disconnect immediately after sending the message as there's no need
    // to keep the connection open since we use it on rare occasions.
    ws.close();
  }

  public async reload() {
    await this.sendMessageToDevice("reload");
  }

  public async openDevMenu() {
    await this.sendMessageToDevice("devMenu");
  }

  public async getDebuggerURL() {
    const WAIT_FOR_DEBUGGER_TIMEOUT_MS = 15_000;

    const startTime = Date.now();
    let websocketAddress: string | undefined;
    while (!websocketAddress && Date.now() - startTime < WAIT_FOR_DEBUGGER_TIMEOUT_MS) {
      websocketAddress = await this.fetchDebuggerURL();
      await new Promise((res) => setTimeout(res, 1000));
    }
    return websocketAddress;
  }

  private lookupWsAddressForOldDebugger(listJson: CDPTargetDescription[]) {
    // Pre 0.76 RN metro lists debugger pages that are identified as "deviceId-pageId"
    // After new device is connected, the deviceId is incremented while pageId could be
    // either 1 or -1 where "-1" corresponds to connection that supports reloads.
    // We search for the most recent device id and want to use special -1 page identifier (reloadable page)
    let recentDeviceId = -1;
    let websocketAddress: string | undefined;
    for (const page of listJson) {
      // pageId can sometimes be negative so we can't just use .split('-') here
      const matches = page.id.match(/([^-]+)-(-?\d+)/);

      if (!matches) {
        continue;
      }
      const pageId = parseInt(matches[2]);
      if (pageId !== -1) {
        continue;
      }
      //If deviceId is a number we want to pick the highest one, with expo it's never a number and we pick the latest record
      if (Number.isInteger(matches[1])) {
        const deviceId = parseInt(matches[1]);
        if (deviceId < recentDeviceId) {
          continue;
        }
        recentDeviceId = deviceId;
      }
      websocketAddress = page.webSocketDebuggerUrl;
    }
    return websocketAddress;
  }

  private filterNewDebuggerPages(listJson: CDPTargetDescription[]) {
    return listJson.filter(
      (page) =>
        page.reactNative &&
        (page.title.startsWith("React Native Bridge") ||
          page.description.endsWith("[C++ connection]"))
    );
  }

  private async isActiveExpoGoAppRuntime(webSocketDebuggerUrl: string) {
    // This method checks for a global variable that is set in the expo host runtime.
    // We expect this variable to not be present in the main app runtime.
    const HIDE_FROM_INSPECTOR_ENV = "(globalThis.__expo_hide_from_inspector__ || 'runtime')";
    try {
      const result = await connectCDPAndEval(webSocketDebuggerUrl, HIDE_FROM_INSPECTOR_ENV);
      if (result === "runtime") {
        return true;
      }
    } catch (e) {
      Logger.warn(
        "Error checking expo go runtime",
        webSocketDebuggerUrl,
        "(this could be stale/inactive runtime)",
        e
      );
    }
    return false;
  }

  private fixupWebSocketDebuggerUrl(websocketAddress: string) {
    // CDP websocket addresses come from metro and in some configurations they
    // still use the default port instead of the ephemeral port that we force metro to use.
    // We override the port and host to match the current metro address.
    const websocketDebuggerUrl = new URL(websocketAddress);
    // replace port number with metro port number:
    websocketDebuggerUrl.port = this._port.toString();
    // replace host with localhost:
    websocketDebuggerUrl.host = "localhost";
    return websocketDebuggerUrl.toString();
  }

  private async lookupWsAddressForNewDebugger(listJson: CDPTargetDescription[]) {
    // In the new debugger, ids are generated in the following format: "deviceId-pageId"
    // but unlike with the old debugger, deviceId is a hex string (UUID most likely)
    // that is stable between reloads.
    // Subsequent runtimes that register get incremented pageId (e.g. main runtime will
    // be 1, reanimated worklet runtime would get 2, etc.)
    // The most recent runtimes are listed first, so we can pick the first one with title
    // that starts with "React Native Bridge" (which is the main runtime)
    const newDebuggerPages = this.filterNewDebuggerPages(listJson);
    if (newDebuggerPages.length > 0) {
      const description = newDebuggerPages[0].description;
      const isExpoGo = description === EXPO_GO_BUNDLE_ID || description === EXPO_GO_PACKAGE_NAME;
      if (isExpoGo) {
        // Expo go apps using the new debugger could report more then one page,
        // if it exist the first one being the Expo Go host runtime.
        // more over expo go on android has a bug causing newDebuggerPages
        // from previously run applications to leak if the host application
        // was not stopped.
        // to solve both issues we check if the runtime is part of
        // the host application process and select the last one that
        // is not. To perform this check we use expo host functionality
        // introduced in https://github.com/expo/expo/pull/32322/files
        for (const newDebuggerPage of newDebuggerPages.reverse()) {
          if (await this.isActiveExpoGoAppRuntime(newDebuggerPage.webSocketDebuggerUrl)) {
            return newDebuggerPage.webSocketDebuggerUrl;
          }
        }
        return undefined;
      }
      return newDebuggerPages[0].webSocketDebuggerUrl;
    }
    return undefined;
  }

  private async fetchDebuggerURL() {
    // query list from http://localhost:${metroPort}/json/list
    const list = await fetch(`http://localhost:${this._port}/json/list`);
    const listJson = await list.json();

    // fixup websocket addresses on the list
    for (const page of listJson) {
      page.webSocketDebuggerUrl = this.fixupWebSocketDebuggerUrl(page.webSocketDebuggerUrl);
    }

    // When there are pages that are identified as belonging to the new debugger, we
    // assume the use of the new debugger and use new debugger logic to determine the websocket address.
    this.usesNewDebugger = this.filterNewDebuggerPages(listJson).length > 0;

    let websocketAddress = this.usesNewDebugger
      ? await this.lookupWsAddressForNewDebugger(listJson)
      : this.lookupWsAddressForOldDebugger(listJson);

    return websocketAddress;
  }
}

function findCustomMetroConfig(configPath: string) {
  for (const folder of workspace.workspaceFolders ?? []) {
    const possibleMetroConfigLocation = Uri.joinPath(folder.uri, configPath);
    if (fs.existsSync(possibleMetroConfigLocation.fsPath)) {
      return possibleMetroConfigLocation.fsPath;
    }
  }
  throw new Error("Metro config cannot be found, please check if `metroConfigPath` path is valid");
}
