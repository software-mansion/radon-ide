import path from "path";
import { Disposable } from "vscode";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
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

  public async ready() {
    if (!this.startPromise) {
      throw new Error("metro not started");
    }
    await this.startPromise;
  }

  public async start(resetCache: boolean) {
    if (this.startPromise) {
      throw new Error("metro already started");
    }
    this.startPromise = this.startInternal(resetCache);
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
      buffer: false,
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
        buffer: false,
      }
    );
  }

  public async startInternal(resetCache: boolean) {
    let appRootFolder = getAppRootFolder();
    await this.devtools.ready();

    const libPath = path.join(extensionContext.extensionPath, "lib");

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
    let bundlerProcess: ChildProcess;
    if (shouldUseExpoCLI()) {
      bundlerProcess = this.launchExpoMetro(appRootFolder, libPath, resetCache, metroEnv);
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
          // sucessfully. However, if it doesn't produce that line and exists, the promise
          // would be waiting indefinitely, so we reject it in that case as well.
          reject(new Error("Metro exited but did not start server successfully."));
        });

      lineReader(bundlerProcess).onLineRead((line) => {
        try {
          const event = JSON.parse(line) as MetroEvent;
          if (event.type !== "bundle_transform_progressed") {
            Logger.debug("Metro", line);
          }
          switch (event.type) {
            case "rnp_initialize_done":
              this._port = event.port;
              Logger.info(`Metro started on port ${this._port}`);
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

function shouldUseExpoCLI() {
  // for expo launcher we use expo_start.js script that override some metro settings since it is not possible to
  // do that by passing command line option like in the case of community CLI's packager script.
  // we need to be able to detect whether the given project should use expo-flavored bundler or not.
  // we assume (and this seem to be working in projects we have tested so far), that if expo CLI is available, the project
  // is either using expo CLI, or it doesn't make a different for the development bundle whether we use expo bundler or not.

  // Since the location of expo package can be different depending on the project configuration, we use the technique here
  // that relies on node's resolve mechanism. We try to resolve expo package in the app root folder, and it it resolves, we
  // assume we can launch expo CLI bundler.
  const appRootFolder = getAppRootFolder();
  return (
    require.resolve("@expo/cli/build/src/start/index", {
      paths: [appRootFolder],
    }) !== undefined
  );
}
