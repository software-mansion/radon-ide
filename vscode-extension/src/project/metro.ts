import path from "path";
import readline from "readline";
import vscode from "vscode";
import { Disposable } from "vscode";
import { exec, ChildProcess } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { extensionContext, getAppRootFolder } from "../utilities/extensionContext";
import { Devtools } from "./devtools";

export interface MetroDelegate {
  onBundleError(message: string): void;
}

type MetroEvent =
  | {
      type: "bundling_error";
      message: string;
      stack: string;
      error?: {
        filename?: string;
        lineNumber?: number;
        column?: number;
      };
    }
  | {
      type: "bundle_transform_progressed";
      transformedFileCount: number;
      totalFileCount: number;
    }
  | {
      type: "rnp_initialize_done";
      port: number;
    };

export class Metro implements Disposable {
  private subprocess?: ChildProcess;
  private _port = 0;
  private startPromise: Promise<void> | undefined;

  constructor(private readonly devtools: Devtools, private readonly delegate: MetroDelegate) {}

  public get port() {
    return this._port;
  }

  public dispose() {
    this.subprocess?.kill(9);
  }

  public async start(resetCache: boolean) {
    if (!this.startPromise) {
      this.startPromise = this.startInternal(resetCache);
    }
    return this.startPromise;
  }

  private launchExpoMetro(
    appRootFolder: string,
    libPath: string,
    resetCache: boolean,
    metroEnv: typeof process.env
  ) {
    return exec(`node`, [path.join(libPath, "expo_start.js"), ...(resetCache ? ["--clear"] : [])], {
      cwd: appRootFolder,
      env: metroEnv,
    });
  }

  private launchPackager(
    appRootFolder: string,
    libPath: string,
    resetCache: boolean,
    metroEnv: typeof process.env
  ) {
    return exec(
      `${appRootFolder}/node_modules/react-native/scripts/packager.sh`,
      [
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
      }
    );
  }

  public async startInternal(resetCache: boolean) {
    let appRootFolder = getAppRootFolder();
    await this.devtools.start();

    const libPath = path.join(extensionContext.extensionPath, "lib");

    // if @expo/cli exists in workspace directory, we assume its an expo project and use expo start command, otherwise we use packager script
    const expoCliPath = path.join(appRootFolder, "node_modules/@expo/cli");
    const expoCliExists = await vscode.workspace.fs.stat(vscode.Uri.file(expoCliPath)).then(
      (stat) => stat.type === vscode.FileType.File,
      () => false
    );
    const metroEnv = {
      ...process.env,
      NODE_PATH: path.join(appRootFolder, "node_modules"),
      RCT_METRO_PORT: "0",
      RCT_DEVTOOLS_PORT: this.devtools.port.toString(),
      REACT_NATIVE_IDE_LIB_PATH: libPath,
      // we disable env plugins as they add additional lines at the top of the bundle that are not
      // taken into acount by source maps. As a result, this messes up line numbers reported by hermes
      // and makes it hard to translate them back to original locations. Once this is fixed, we
      // can restore this plugin.
      EXPO_NO_CLIENT_ENV_VARS: "true",
    };
    if (expoCliExists) {
      // should be able to use expo metro here
      this.subprocess = this.launchExpoMetro(appRootFolder, libPath, resetCache, metroEnv);
    } else {
      this.subprocess = this.launchPackager(appRootFolder, libPath, resetCache, metroEnv);
    }

    const rl = readline.createInterface({
      input: this.subprocess!.stdout!,
      output: process.stdout,
      terminal: false,
    });

    const initPromise = new Promise<void>((resolve, reject) => {
      // reject if process exits
      this.subprocess!.on("exit", (code) => {
        reject(new Error(`Metro exited with code ${code}`));
      });
      rl.on("line", (line: string) => {
        try {
          const event = JSON.parse(line) as MetroEvent;
          if (event.type !== "bundle_transform_progressed") {
            Logger.debug("Metro", line);
          }
          switch (event.type) {
            case "rnp_initialize_done":
              this._port = event.port;
              resolve();
              break;
            case "bundling_error":
              Logger.error("Bundling error", event.message);
              this.delegate.onBundleError(event.message);
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

  public async reload() {
    await fetch(`http://localhost:${this._port}/reload`);
  }

  public async getDebuggerURL(timeoutMs: number) {
    const startTime = Date.now();
    let websocketAddress: string | undefined;
    while (!websocketAddress && Date.now() - startTime < timeoutMs) {
      websocketAddress = await this.fetchDebuggerURL();
      await new Promise((res) => setTimeout(res, 1000));
    }
    return websocketAddress;
  }

  private async fetchDebuggerURL() {
    // query list from http://localhost:${metroPort}/json/list
    const list = await fetch(`http://localhost:${this._port}/json/list`);
    const listJson = await list.json();
    // with metro, pages are identified as "deviceId-pageId", we search for the most
    // recent device id and want want to use special -1 page identifier (reloadable page)
    let recentDeviceId = -1;
    let websocketAddress: string | undefined;
    for (const page of listJson) {
      // pageId can sometimes be negative so we can't just use .split('-') here
      const matches = page.id.match(/(\d+)-(-?\d+)/);
      if (matches) {
        const deviceId = parseInt(matches[1]);
        const pageId = parseInt(matches[2]);
        if (deviceId > recentDeviceId && pageId === -1) {
          recentDeviceId = deviceId;
          // In RN 73 metro has a bug where websocket URL returns 0 as port number when starting with port number set as 0 (ephemeral port)
          // we want to replace it with the actual port number from metro:
          // parse websocket URL:
          const websocketDebuggerUrl = new URL(page.webSocketDebuggerUrl);
          // replace port number with metro port number:
          if (websocketDebuggerUrl.port === "0") {
            websocketDebuggerUrl.port = this._port.toString();
          }
          websocketAddress = websocketDebuggerUrl.toString();
        }
      }
    }

    return websocketAddress;
  }
}
