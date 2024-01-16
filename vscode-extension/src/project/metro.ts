import path from "path";
import readline from "readline";
import { Disposable } from "vscode";
import { exec, ChildProcess } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { Devtools } from "./devtools";
import { getWorkspacePath } from "../utilities/common";

export class Metro implements Disposable {
  private subprocess?: ChildProcess;
  private _port = 0;
  private startPromise: Promise<void> | undefined;

  constructor(private readonly devtools: Devtools) {}

  public get port() {
    return this._port;
  }

  public dispose() {
    this.subprocess?.kill();
  }

  public async start(resetCache: boolean) {
    if (!this.startPromise) {
      this.startPromise = this.startInternal(resetCache);
    }
    return this.startPromise;
  }

  public async startInternal(resetCache: boolean) {
    let workspaceDir = getWorkspacePath();
    if (!workspaceDir) {
      Logger.warn("No workspace directory found");
      return;
    }
    await this.devtools.start();
    const libPath = path.join(extensionContext.extensionPath, "lib");
    this.subprocess = exec(
      `${workspaceDir}/node_modules/react-native/scripts/packager.sh`,
      [
        ...(resetCache ? ["--reset-cache"] : []),
        "--no-interactive",
        "--port",
        "0",
        "--config",
        path.join(libPath, "metro_config.js"),
      ],
      {
        cwd: workspaceDir,
        env: {
          ...process.env,
          NODE_PATH: path.join(workspaceDir, "node_modules"),
          RCT_METRO_PORT: "0",
          RCT_DEVTOOLS_PORT: this.devtools.port.toString(),
          REACT_NATIVE_IDE_LIB_PATH: libPath,
          // we disable env plugins as they add additional lines at the top of the bundle that are not
          // taken into acount by source maps. As a result, this messes up line numbers reported by hermes
          // and makes it hard to translate them back to original locations. Once this is fixed, we
          // can restore this plugin.
          EXPO_NO_CLIENT_ENV_VARS: "true",
        },
      }
    );

    const rl = readline.createInterface({
      input: this.subprocess!.stdout!,
      output: process.stdout,
      terminal: false,
    });

    const initPromise = new Promise<void>((resolve, reject) => {
      rl.on("line", (line: string) => {
        if (line.startsWith("METRO_READY")) {
          // parse metro port from the message, message is in format: METRO_READY <port_number>
          this._port = parseInt(line.split(" ")[1]);
          resolve();
        }
        Logger.debug("Metro", line);
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
