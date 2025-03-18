import path from "path";
import fs from "fs";
import WebSocket from "ws";
import { Disposable, ExtensionMode, Uri, workspace } from "vscode";
import stripAnsi from "strip-ansi";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import { Devtools } from "./devtools";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { EXPO_GO_BUNDLE_ID, EXPO_GO_PACKAGE_NAME } from "../builders/expoGo";
import { connectCDPAndEval } from "../utilities/connectCDPAndEval";
import { progressiveRetryTimeout, sleep } from "../utilities/retry";
import { getOpenPort } from "../utilities/common";
import { DebugSource } from "../debugging/DebugSession";
import { openFileAtPosition } from "../utilities/openFileAtPosition";

const FAKE_EDITOR = "RADON_IDE_FAKE_EDITOR";
const OPENING_IN_FAKE_EDITOR_REGEX = new RegExp(`Opening (.+) in ${FAKE_EDITOR}`);

export interface MetroDelegate {
  onBundleBuildFailedError(): void;
  onBundlingError(message: string, source: DebugSource, errorModulePath: string): void;
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
        filename?: string;
        lineNumber?: number;
        columnNumber?: number;
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
      type: "initialize_done";
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
    dependencies: Promise<any>[],
    appRoot: string
  ) {
    if (this.startPromise) {
      throw new Error("metro already started");
    }
    this.startPromise = this.startInternal(resetCache, progressListener, dependencies, appRoot);
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
    port: number,
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
        `${port}`,
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
    dependencies: Promise<any>[],
    appRoot: string
  ) {
    const launchConfiguration = getLaunchConfiguration();
    await Promise.all([this.devtools.ready()].concat(dependencies));

    const libPath = path.join(extensionContext.extensionPath, "lib");
    let metroConfigPath: string | undefined;
    if (launchConfiguration.metroConfigPath) {
      metroConfigPath = findCustomMetroConfig(launchConfiguration.metroConfigPath);
    }
    const isExtensionDev = extensionContext.extensionMode === ExtensionMode.Development;

    const port = await getOpenPort();

    // NOTE: this is needed to capture metro's open-stack-frame calls.
    // See `packages/vscode-extension/atom` script for more details.
    const fakeEditorPath = extensionContext.asAbsolutePath("dist/atom");

    const metroEnv = {
      ...launchConfiguration.env,
      ...(metroConfigPath ? { RN_IDE_METRO_CONFIG_PATH: metroConfigPath } : {}),
      NODE_PATH: path.join(appRoot, "node_modules"),
      RCT_METRO_PORT: `${port}`,
      RCT_DEVTOOLS_PORT: this.devtools.port.toString(),
      RADON_IDE_LIB_PATH: libPath,
      RADON_IDE_VERSION: extensionContext.extension.packageJSON.version,
      REACT_EDITOR: fakeEditorPath,
      // NOTE: At least as of version 52, Expo uses a different mechanism to open stack frames in the editor,
      // which doesn't allow passing a path to the EDITOR executable.
      // Instead, we pass it a fake editor name and inspect the debug logs to extract the file path to open.
      DEBUG: "expo:utils:editor",
      EXPO_EDITOR: FAKE_EDITOR,
      ...(isExtensionDev ? { RADON_IDE_DEV: "1" } : {}),
    };
    let bundlerProcess: ChildProcess;

    if (shouldUseExpoCLI(appRoot)) {
      bundlerProcess = this.launchExpoMetro(
        appRoot,
        libPath,
        resetCache,
        launchConfiguration.expoStartArgs,
        metroEnv
      );
    } else {
      bundlerProcess = this.launchPackager(appRoot, port, libPath, resetCache, metroEnv);
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
        const handleMetroEvent = (event: MetroEvent) => {
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
            case "initialize_done":
              this._port = event.port;
              Logger.info(`Metro started on port ${this._port}`);
              resolve();
              break;
            case "RNIDE_watch_folders":
              this._watchFolders = event.watchFolders;
              Logger.info("Captured metro watch folders", this._watchFolders);
              break;
            case "bundle_build_failed":
              this.delegate.onBundleBuildFailedError();
              break;
            case "bundling_error":
              const message = stripAnsi(event.message);
              let filename = event.error.originModulePath;
              if (!filename && event.error.filename) {
                filename = path.join(appRoot, event.error.filename);
              }
              this.delegate.onBundlingError(
                message,
                {
                  filename,
                  line1based: event.error.lineNumber,
                  column0based: event.error.columnNumber,
                },
                event.error.originModulePath
              );
              break;
          }
        };

        let event: MetroEvent | undefined;
        try {
          event = JSON.parse(line) as MetroEvent;
        } catch {}

        if (event) {
          handleMetroEvent(event);
          return;
        }

        Logger.debug("Metro", line);

        if (line.startsWith("__RNIDE__open_editor__ ")) {
          this.handleOpenEditor(line.slice("__RNIDE__open_editor__ ".length));
        } else if (line.includes(FAKE_EDITOR)) {
          const matches = line.match(OPENING_IN_FAKE_EDITOR_REGEX);
          if (matches?.length) {
            this.handleOpenEditor(matches[1]);
          }
        }
      });
    });

    return initPromise;
  }

  private handleOpenEditor(payload: string) {
    // NOTE: this regex matches `fileName[:lineNumber][:columnNumber]` format:
    // - (.+?) - fileName (any character, non-greedy to allow for the trailing numbers)
    // - (?::(\d+))? - optional ":number", not capturing the colon
    const matches = /^(.+?)(?::(\d+))?(?::(\d+))?$/.exec(payload);
    if (!matches) {
      return;
    }
    const fileName = matches[1];
    const lineNumber = matches[2] ? parseInt(matches[2], 10) - 1 : 0;
    const columnNumber = matches[3] ? parseInt(matches[3], 10) - 1 : 0;
    openFileAtPosition(fileName, lineNumber, columnNumber);
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
          page.description.endsWith("[C++ connection]") ||
          page.reactNative.capabilities?.prefersFuseboxFrontend)
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

  public async fetchWsTargets(): Promise<CDPTargetDescription[] | undefined> {
    const WAIT_FOR_DEBUGGER_TIMEOUT_MS = 15_000;

    let retryCount = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < WAIT_FOR_DEBUGGER_TIMEOUT_MS) {
      retryCount++;

      try {
        const list = await fetch(`http://localhost:${this._port}/json/list`);
        const listJson = await list.json();

        if (listJson.length > 0) {
          // fixup websocket addresses on the list
          for (const page of listJson) {
            page.webSocketDebuggerUrl = this.fixupWebSocketDebuggerUrl(page.webSocketDebuggerUrl);
          }

          return listJson;
        }
      } catch (_) {
        // It shouldn't happen, so lets warn about it. Except a warning we will retry anyway, so nothing to do here.
        Logger.warn("[METRO] Fetching list of runtimes failed, retrying...");
      }

      await sleep(progressiveRetryTimeout(retryCount));
    }

    return undefined;
  }

  public async getDebuggerURL() {
    const listJson = await this.fetchWsTargets();

    if (listJson === undefined) {
      return undefined;
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
