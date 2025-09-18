import path from "path";
import fs from "fs";
import assert from "assert";
import stripAnsi from "strip-ansi";
import { Disposable, EventEmitter, ExtensionMode, Uri, workspace } from "vscode";
import _ from "lodash";
import { DebugSource } from "../debugging/DebugSession";
import { ResolvedLaunchConfig } from "./ApplicationContext";
import { ChildProcess, exec, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { IDE } from "./ide";
import { Output } from "../common/OutputChannel";
import { extensionContext } from "../utilities/extensionContext";
import { getOpenPort } from "../utilities/common";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import { CancelToken } from "../utilities/cancelToken";
import { connectCDPAndEval } from "../utilities/connectCDPAndEval";
import { EXPO_GO_BUNDLE_ID, EXPO_GO_PACKAGE_NAME } from "../builders/expoGo";
import { sleep, progressiveRetryTimeout } from "../utilities/retry";
import { openFileAtPosition } from "../utilities/editorOpeners";
import { DeviceInfo, DevicePlatform } from "../common/State";

export interface MetroSession {
  port: number;
  sourceMapPathOverrides: Record<string, string>;
  expoPreludeLineCount: number;

  onBundleError: (listener: (event: BundleErrorEvent) => void) => Disposable;
  onBundleProgress: (listener: (event: BundleProgressEvent) => void) => Disposable;
  onServerStopped: (listener: () => void) => Disposable;

  getDebuggerURL(
    timeoutMs: number,
    cancelToken?: CancelToken
  ): Promise<DebuggerTargetDescription | undefined>;
  getDebuggerPages(timeoutMs: number, cancelToken?: CancelToken): Promise<CDPTargetDescription[]>;
  reload(): Promise<void>;
  openDevMenu(): Promise<void>;
}

export interface MetroProvider {
  getMetroSession(options: { resetCache: boolean }): Promise<MetroSession & Disposable>;
  restartServer(options: { resetCache: boolean }): Promise<MetroSession & Disposable>;
}

export class SharedMetroProvider implements MetroProvider, Disposable {
  private metroSession?: Promise<MetroSession & Disposable>;
  constructor(
    private readonly launchConfiguration: ResolvedLaunchConfig,
    private readonly devtoolsPort: number | undefined,
    private readonly dependencies: Promise<unknown>[]
  ) {}

  public getMetroSession({ resetCache }: { resetCache: boolean }) {
    if (!this.metroSession) {
      this.metroSession = launchMetro({
        devtoolsPort: this.devtoolsPort,
        launchConfiguration: this.launchConfiguration,
        dependencies: this.dependencies,
        resetCache,
      });
    }
    return this.metroSession;
  }

  public restartServer({ resetCache }: { resetCache: boolean }) {
    this.metroSession?.then((session) => session.dispose());
    this.metroSession = launchMetro({
      devtoolsPort: this.devtoolsPort,
      launchConfiguration: this.launchConfiguration,
      dependencies: this.dependencies,
      resetCache,
    });
    return this.metroSession;
  }

  public dispose() {
    this.metroSession?.then((session) => session.dispose());
  }
}

interface CDPTargetDescription {
  id: string;
  appId?: string;
  deviceName: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
  description?: string;
  reactNative?: {
    capabilities?: {
      prefersFuseboxFrontend?: boolean;
    };
  };
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
        string, // todo: ensure what this field means
      ];
    };

interface BundleErrorEvent {
  message: string;
  source: DebugSource;
  errorModulePath: string;
}

interface BundleProgressEvent {
  bundleProgress: number;
}

const FAKE_EDITOR = "RADON_IDE_FAKE_EDITOR";
const OPENING_IN_FAKE_EDITOR_REGEX = new RegExp(`Opening (.+) in ${FAKE_EDITOR}`);

async function launchMetro({
  resetCache,
  dependencies,
  launchConfiguration,
  devtoolsPort,
}: {
  resetCache: boolean;
  dependencies: Promise<unknown>[];
  launchConfiguration: ResolvedLaunchConfig;
  devtoolsPort?: number;
}): Promise<MetroSession & Disposable> {
  const appRoot = launchConfiguration.absoluteAppRoot;
  await Promise.all(dependencies);

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

  const metroEnv: Record<string, string> = {
    ...launchConfiguration.env,
    ...(metroConfigPath ? { RN_IDE_METRO_CONFIG_PATH: metroConfigPath } : {}),
    NODE_PATH: path.join(appRoot, "node_modules"),
    RCT_METRO_PORT: `${port}`,
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

  if (devtoolsPort !== undefined) {
    metroEnv.RCT_DEVTOOLS_PORT = devtoolsPort.toString();
  }

  if (shouldUseExpoCLI(launchConfiguration)) {
    return await SubprocessMetroSession.launchExpoMetro(
      appRoot,
      libPath,
      resetCache,
      launchConfiguration.expoStartArgs,
      metroEnv
    );
  } else {
    return await SubprocessMetroSession.launchBareMetro(
      appRoot,
      port,
      libPath,
      resetCache,
      metroEnv
    );
  }
}

const WAIT_FOR_DEBUGGER_TIMEOUT_MS = 15_000;

export class Metro implements MetroSession, Disposable {
  protected _expoPreludeLineCount = 0;
  protected _watchFolders: string[] | undefined = undefined;
  protected readonly metroOutputChannel;

  protected readonly bundleErrorEventEmitter = new EventEmitter<BundleErrorEvent>();
  protected readonly bundleProgressEventEmitter = new EventEmitter<BundleProgressEvent>();
  protected readonly onServerStoppedEventEmitter = new EventEmitter<void>();
  public readonly onBundleError = this.bundleErrorEventEmitter.event;
  public readonly onBundleProgress = this.bundleProgressEventEmitter.event;
  public readonly onServerStopped = this.onServerStoppedEventEmitter.event;

  constructor(
    protected _port: number,
    protected readonly appRoot: string
  ) {
    const metroOutputChannel =
      IDE.getInstanceIfExists()?.outputChannelRegistry.getOrCreateOutputChannel(
        Output.MetroBundler
      );
    if (!metroOutputChannel) {
      throw new Error("Cannot start bundler process. The IDE is not initialized.");
    }
    this.metroOutputChannel = metroOutputChannel;
  }

  public get port(): number {
    assert(this._port, "Metro session is not used before it's initialized");
    return this._port;
  }

  public async getDebuggerPages(
    timeoutMs: number,
    cancelToken?: CancelToken
  ): Promise<CDPTargetDescription[]> {
    return (await this.fetchWsTargets(timeoutMs, cancelToken)) || [];
  }

  public async getDebuggerURL(
    timeoutMs: number | undefined = WAIT_FOR_DEBUGGER_TIMEOUT_MS,
    cancelToken: CancelToken = new CancelToken()
  ): Promise<DebuggerTargetDescription | undefined> {
    const listJson = await this.fetchWsTargets(timeoutMs, cancelToken);

    if (listJson === undefined) {
      return undefined;
    }

    return pickDebuggerTarget(listJson);
  }

  public async reload() {
    await this.sendMessageToDevice("reload");
  }

  public async openDevMenu() {
    await this.sendMessageToDevice("devMenu");
  }

  public get sourceMapPathOverrides() {
    if (this._watchFolders === undefined) {
      throw new Error("Attempting to read sourceMapPathOverrides before metro has started");
    }
    const sourceMapPathOverrides: Record<string, string> = {};
    if (this._watchFolders.length > 0) {
      sourceMapPathOverrides["/[metro-project]/*"] = `${this._watchFolders[0]}${path.sep}*`;
      this._watchFolders.forEach((watchFolder, index) => {
        sourceMapPathOverrides[`/[metro-watchFolders]/${index}/*`] = `${watchFolder}${path.sep}*`;
      });
    }
    return sourceMapPathOverrides;
  }

  public get expoPreludeLineCount() {
    return this._expoPreludeLineCount;
  }

  private async sendMessageToDevice(method: "devMenu" | "reload") {
    // we use metro's /message websocket endpoint to deliver specifically formatted
    // messages to the device.
    // Metro implements a websocket proxy that proxies messages between connected
    // clients. This is a mechanism used by the CLI to deliver messages for things
    // like reload or open dev menu.
    // The message format is a JSON object with a "method" field that specifies
    // the action, and version field with the protocol version (currently 2).
    const ws = new WebSocket(`ws://localhost:${this.port}/message`);
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

  private async fetchWsTargets(
    timeoutMs: number = WAIT_FOR_DEBUGGER_TIMEOUT_MS,
    cancelToken: CancelToken = new CancelToken()
  ): Promise<CDPTargetDescription[] | undefined> {
    let retryCount = 0;
    const startTime = performance.now();

    function shouldContinue() {
      if (timeoutMs >= 0) {
        if (performance.now() - startTime > timeoutMs) {
          return false;
        }
      }

      return !cancelToken.cancelled;
    }

    while (shouldContinue()) {
      retryCount++;

      try {
        const list = await fetch(`http://localhost:${this.port}/json/list`);
        const listJson = await list.json();

        if (listJson.length > 0) {
          // fixup websocket addresses on the list
          for (const page of listJson) {
            page.webSocketDebuggerUrl = this.fixupWebSocketDebuggerUrl(page.webSocketDebuggerUrl);
          }

          return listJson;
        }
      } catch {
        // It shouldn't happen, so lets warn about it. Except a warning we will retry anyway, so nothing to do here.
        Logger.warn("[METRO] Fetching list of runtimes failed, retrying...");
      }

      await cancelToken.adapt(sleep(progressiveRetryTimeout(retryCount))).catch(() => {
        // ignore the CancelError, we'll just break out of the loop after the condition is checked next time
      });
    }

    return undefined;
  }

  private fixupWebSocketDebuggerUrl(websocketAddress: string) {
    // CDP websocket addresses come from metro and in some configurations they
    // still use the default port instead of the ephemeral port that we force metro to use.
    // We override the port and host to match the current metro address.
    const websocketDebuggerUrl = new URL(websocketAddress);
    // replace port number with metro port number:
    websocketDebuggerUrl.port = this.port.toString();
    // replace host with localhost:
    websocketDebuggerUrl.host = "localhost";
    return websocketDebuggerUrl.toString();
  }

  public dispose() {
    this.bundleErrorEventEmitter.dispose();
    this.bundleProgressEventEmitter.dispose();
  }
}

class SubprocessMetroSession extends Metro implements Disposable {
  protected readonly bundlerReady = Promise.withResolvers<void>();

  public static async launchBareMetro(
    appRootFolder: string,
    port: number,
    libPath: string,
    resetCache: boolean,
    metroEnv: Record<string, string>
  ): Promise<SubprocessMetroSession> {
    const reactNativeRoot = path.dirname(
      require.resolve("react-native", { paths: [appRootFolder] })
    );
    const packagerProcess = exec(
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
    const session = new SubprocessMetroSession(packagerProcess, appRootFolder);
    await session.bundlerReady.promise;
    return session;
  }

  public static async launchExpoMetro(
    appRootFolder: string,
    libPath: string,
    resetCache: boolean,
    expoStartExtraArgs: string[] | undefined,
    metroEnv: typeof process.env
  ): Promise<SubprocessMetroSession> {
    const args = [path.join(libPath, "expo_start.js")];
    if (resetCache) {
      args.push("--clear");
    }
    if (expoStartExtraArgs) {
      args.push(...expoStartExtraArgs);
    }

    const packagerProcess = exec("node", args, {
      cwd: appRootFolder,
      env: metroEnv,
      buffer: false,
    });
    const session = new SubprocessMetroSession(packagerProcess, appRootFolder);
    await session.bundlerReady.promise;
    return session;
  }

  private constructor(
    private readonly bundlerProcess: ChildProcess,
    appRoot: string
  ) {
    super(0, appRoot);
    lineReader(bundlerProcess).onLineRead((line) => {
      try {
        const event = JSON.parse(line) as MetroEvent;
        this.handleMetroEvent(event);
        return;
      } catch {}

      Logger.debug("Metro", line);

      if (!line.startsWith("__RNIDE__")) {
        this.metroOutputChannel.appendLine(line);
      }

      if (line.startsWith("__RNIDE__open_editor__ ")) {
        this.handleOpenEditor(line.slice("__RNIDE__open_editor__ ".length));
      } else if (line.includes(FAKE_EDITOR)) {
        const matches = line.match(OPENING_IN_FAKE_EDITOR_REGEX);
        if (matches?.length) {
          this.handleOpenEditor(matches[1]);
        }
      }
    });

    // NOTE: if the process exits before the "initialize_done" event, we reject the promise
    bundlerProcess
      .catch(() => {
        // ignore the error, we are only interested in the process exit
      })
      .then(() => {
        this.bundlerReady.reject(new Error("Metro bundler exited unexpectedly"));
        this.onServerStoppedEventEmitter.fire();
      });
  }

  protected handleMetroEvent = (event: MetroEvent) => {
    if (event.type === "bundle_transform_progressed") {
      // Because totalFileCount grows as bundle_transform progresses at the beginning there are a few logs that indicate 100% progress thats why we ignore them
      if (event.totalFileCount > 10) {
        const bundleProgress = event.transformedFileCount / event.totalFileCount;
        this.bundleProgressEventEmitter.fire({ bundleProgress });
      }
    } else if (event.type === "client_log" && event.level === "error") {
      const err = stripAnsi(event.data[0]);
      Logger.error(err);
      this.metroOutputChannel.appendLine(err);
    } else {
      Logger.debug("Metro", event);
    }

    switch (event.type) {
      case "RNIDE_expo_env_prelude_lines":
        this._expoPreludeLineCount = event.lineCount;
        Logger.debug("Expo prelude line offset was set to: ", this._expoPreludeLineCount);
        break;
      case "initialize_done":
        this._port = event.port;
        const log = `Metro started on port ${this._port}`;
        this.metroOutputChannel.appendLine(log);
        Logger.info(log);
        this.bundlerReady.resolve();
        break;
      case "RNIDE_watch_folders":
        this._watchFolders = event.watchFolders;
        Logger.info("Captured metro watch folders", this._watchFolders);
        break;
      case "bundling_error":
        const message = stripAnsi(event.message);
        let filename = event.error.originModulePath;
        if (!filename && event.error.filename) {
          filename = path.join(this.appRoot, event.error.filename);
        }
        const source = {
          filename,
          line1based: event.error.lineNumber,
          column0based: event.error.columnNumber,
        };
        const errorModulePath = event.error.originModulePath;
        this.bundleErrorEventEmitter.fire({ message, source, errorModulePath });
        this.metroOutputChannel.appendLine(
          `[Bundling Error]: ${filename}:${source.line1based}:${source.column0based}: ${message}`
        );
        break;
    }
  };

  protected handleOpenEditor(payload: string) {
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

  public dispose() {
    super.dispose();
    this.bundlerProcess.kill();
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

interface DebuggerTargetDescription {
  websocketAddress: string;
  isUsingNewDebugger: boolean;
}

export async function getDebuggerTargetForDevice(
  metro: MetroSession,
  deviceInfo: DeviceInfo,
  cancelToken: CancelToken,
  timeoutMs?: number
): Promise<DebuggerTargetDescription | undefined> {
  const now = performance.now();
  const deadline = timeoutMs ? now + timeoutMs : undefined;
  while (deadline ?? Number.POSITIVE_INFINITY > performance.now()) {
    try {
      const remainingTimeout = deadline ? Math.max(1, deadline - performance.now()) : -1;
      const debuggerPages = await metro.getDebuggerPages(remainingTimeout, cancelToken);
      const pagesForDevice = debuggerPages.filter((target) => {
        if (deviceInfo.platform === DevicePlatform.IOS) {
          // On iOS, we want to connect to the target that has the same bundle ID as our app
          return target.deviceName === deviceInfo.displayName;
        } else {
          return target.deviceName.startsWith("sdk_gphone64_");
        }
      });
      return await pickDebuggerTarget(pagesForDevice);
    } catch (e) {
      if (cancelToken.cancelled) {
        return undefined;
      }
      throw e;
    }
  }
}

function isNewDebuggerPage(page: CDPTargetDescription) {
  return (
    page.reactNative &&
    (page.title.startsWith("React Native Bridge") ||
      page.description?.endsWith("[C++ connection]") ||
      page.reactNative?.capabilities?.prefersFuseboxFrontend)
  );
}

async function isActiveExpoGoAppRuntime(webSocketDebuggerUrl: string) {
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

async function lookupWsAddressForNewDebugger(listJson: CDPTargetDescription[]) {
  // In the new debugger, ids are generated in the following format: "deviceId-pageId"
  // but unlike with the old debugger, deviceId is a hex string (UUID most likely)
  // that is stable between reloads.
  // Subsequent runtimes that register get incremented pageId (e.g. main runtime will
  // be 1, reanimated worklet runtime would get 2, etc.)
  // The most recent runtimes are listed first, so we can pick the first one with title
  // that starts with "React Native Bridge" (which is the main runtime)
  const newDebuggerPages = listJson.filter(isNewDebuggerPage);
  if (newDebuggerPages.length > 0) {
    const description = newDebuggerPages[0].description;
    const appId = newDebuggerPages[0]?.appId;
    const isExpoGo =
      description === EXPO_GO_BUNDLE_ID ||
      description === EXPO_GO_PACKAGE_NAME ||
      appId === EXPO_GO_BUNDLE_ID ||
      appId === EXPO_GO_PACKAGE_NAME;
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
        if (await isActiveExpoGoAppRuntime(newDebuggerPage.webSocketDebuggerUrl)) {
          return newDebuggerPage.webSocketDebuggerUrl;
        }
      }
      return undefined;
    }
    return newDebuggerPages[0].webSocketDebuggerUrl;
  }
  return undefined;
}

function lookupWsAddressForOldDebugger(listJson: CDPTargetDescription[]) {
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

async function pickDebuggerTarget(listJson: CDPTargetDescription[]) {
  const [newDebuggerPages, oldDebuggerPages] = _.partition(listJson, isNewDebuggerPage);
  const usesNewDebugger = newDebuggerPages.length > 0;
  const websocketAddress = usesNewDebugger
    ? await lookupWsAddressForNewDebugger(newDebuggerPages)
    : lookupWsAddressForOldDebugger(oldDebuggerPages);

  if (websocketAddress) {
    return { websocketAddress, isUsingNewDebugger: usesNewDebugger };
  }
}
