import path from "path";
import fs from "fs";
import stripAnsi from "strip-ansi";
import WebSocket from "ws";
import { Disposable, EventEmitter, ExtensionMode, Uri, workspace } from "vscode";
import _ from "lodash";
import { DebugSource } from "../debugging/DebugSession";
import { ResolvedLaunchConfig } from "./ApplicationContext";
import { ChildProcess, command, exec, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { IDE } from "./ide";
import { Output } from "../common/OutputChannel";
import { extensionContext } from "../utilities/extensionContext";
import { getOpenPort } from "../utilities/common";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import { openFileAtPosition } from "../utilities/editorOpeners";
import { createRefCounted, RefCounted } from "../utilities/refCounted";

export class MetroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetroError";
  }
}

export interface MetroSession {
  port: number;
  sourceMapPathOverrides: Record<string, string>;
  expoPreludeLineCount: number;

  disposed: boolean;

  onBundleError: (listener: (event: BundleErrorEvent) => void) => Disposable;
  onBundleProgress: (listener: (event: BundleProgressEvent) => void) => Disposable;

  getDebuggerPages(): Promise<CDPTargetDescription[]>;
  reload(): Promise<void>;
  openDevMenu(): Promise<void>;
}

export interface MetroProvider {
  getMetroSession(options: { resetCache: boolean }): Promise<MetroSession & Disposable>;
  restartServer(options: { resetCache: boolean }): Promise<MetroSession & Disposable>;
}

export class UniqueMetroProvider implements MetroProvider {
  constructor(
    private readonly launchConfiguration: ResolvedLaunchConfig,
    private readonly devtoolsPort: Promise<number | undefined> = Promise.resolve(undefined)
  ) {}

  public async getMetroSession(options: {
    resetCache: boolean;
  }): Promise<MetroSession & Disposable> {
    return launchMetro({
      devtoolsPort: await this.devtoolsPort,
      launchConfiguration: this.launchConfiguration,
      resetCache: options.resetCache,
    });
  }

  public restartServer(options: { resetCache: boolean }): Promise<MetroSession & Disposable> {
    return this.getMetroSession(options);
  }
}

export class SharedMetroProvider implements MetroProvider, Disposable {
  private readonly port: number | undefined;
  private metroSession?: Promise<RefCounted<MetroSession & Disposable>>;

  constructor(
    private readonly launchConfiguration: ResolvedLaunchConfig,
    private readonly devtoolsPort: Promise<number | undefined> = Promise.resolve(undefined)
  ) {
    this.port = this.launchConfiguration.metroPort;
  }

  public async getMetroSession({ resetCache }: { resetCache: boolean }) {
    let session;
    try {
      session = await this.metroSession;
    } catch (e) {
      // NOTE: if the previous metro session failed to start, we ignore the error and start a new one
    }
    if (session === undefined || session.refCount <= 0 || resetCache) {
      return this.createNewSession(resetCache);
    }

    session.retain();
    return session;
  }

  public async restartServer({ resetCache }: { resetCache: boolean }) {
    const session = await this.metroSession;
    session?.disposeInner();
    return this.createNewSession(resetCache);
  }

  private createNewSession(resetCache: boolean) {
    this.metroSession = this.devtoolsPort
      .then((devtoolsPort) =>
        launchMetro({
          port: this.port,
          devtoolsPort,
          launchConfiguration: this.launchConfiguration,
          resetCache,
        })
      )
      .then(createRefCounted);
    return this.metroSession;
  }

  public dispose() {
    this.metroSession?.then((session) => session.dispose());
  }
}

export interface CDPTargetDescription {
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
    logicalDeviceId?: string;
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
  port,
  resetCache,
  launchConfiguration,
  devtoolsPort,
}: {
  port?: number;
  resetCache: boolean;
  launchConfiguration: ResolvedLaunchConfig;
  devtoolsPort?: number;
}): Promise<MetroSession & Disposable> {
  const appRoot = launchConfiguration.absoluteAppRoot;

  const libPath = path.join(extensionContext.extensionPath, "lib");
  let metroConfigPath: string | undefined;
  if (launchConfiguration.metroConfigPath) {
    metroConfigPath = findCustomMetroConfig(launchConfiguration.metroConfigPath);
  }
  const isExtensionDev = extensionContext.extensionMode === ExtensionMode.Development;

  port = port ?? (await getOpenPort());

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
    RADON_IDE_RN_VERSION: "0.81",
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
      port,
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

export class Metro implements MetroSession, Disposable {
  protected _expoPreludeLineCount = 0;
  protected _watchFolders: string[] | undefined;
  protected readonly metroOutputChannel;

  protected readonly bundleErrorEventEmitter = new EventEmitter<BundleErrorEvent>();
  protected readonly bundleProgressEventEmitter = new EventEmitter<BundleProgressEvent>();
  public readonly onBundleError = this.bundleErrorEventEmitter.event;
  public readonly onBundleProgress = this.bundleProgressEventEmitter.event;

  protected _disposed = false;

  public get disposed() {
    return this._disposed;
  }

  constructor(
    public readonly port: number,
    protected readonly appRoot: string,
    watchFolders: string[] | undefined = undefined
  ) {
    this._watchFolders = watchFolders;

    const metroOutputChannel =
      IDE.getInstanceIfExists()?.outputChannelRegistry.getOrCreateOutputChannel(
        Output.MetroBundler
      );
    if (!metroOutputChannel) {
      throw new MetroError("Cannot start bundler process. The IDE is not initialized.");
    }
    this.metroOutputChannel = metroOutputChannel;
  }

  public async getDebuggerPages(): Promise<CDPTargetDescription[]> {
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
    } catch {}
    return [];
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
    this._disposed = true;
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
    const session = new SubprocessMetroSession(packagerProcess, appRootFolder, port);
    await session.bundlerReady.promise;
    return session;
  }

  public static async launchExpoMetro(
    appRootFolder: string,
    port: number,
    libPath: string,
    resetCache: boolean,
    expoStartExtraArgs: string[] | undefined,
    metroEnv: typeof process.env
  ): Promise<SubprocessMetroSession> {
    const args = [path.join(libPath, "expo", "expo_start.js"), "--port", `${port}`];
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
    const session = new SubprocessMetroSession(packagerProcess, appRootFolder, port);
    await session.bundlerReady.promise;
    return session;
  }

  private constructor(
    private readonly bundlerProcess: ChildProcess,
    appRoot: string,
    port: number
  ) {
    super(port, appRoot);
    const PORT_IN_USE_MESSAGE = `The Metro server could not start: port ${this.port} is already in use.`;

    lineReader(bundlerProcess).onLineRead((line) => {
      try {
        const event = JSON.parse(line) as MetroEvent;
        this.handleMetroEvent(event);
        return;
      } catch {}

      Logger.debug("Metro", line);

      if (line.includes("EADDRINUSE")) {
        this.bundlerReady.reject(new MetroError(PORT_IN_USE_MESSAGE));
      }

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
      .catch(async () => {
        // ignore the error, we are only interested in the process exit
        const { stdout } = await command("netstat -an");
        if (stdout.includes(`.${this.port}`)) {
          this.bundlerReady.reject(new MetroError(PORT_IN_USE_MESSAGE));
        }
      })
      .then(() => {
        this.bundlerReady.reject(new MetroError("Metro bundler exited unexpectedly"));
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
        const log = `Metro started on port ${this.port}`;
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
  throw new MetroError(
    "Metro config cannot be found, please check if `metroConfigPath` path is valid"
  );
}
