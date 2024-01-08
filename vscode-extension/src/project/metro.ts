import path from "path";
import readline from "readline";
import { Disposable } from "vscode";
import { exec, ChildProcess } from "../utilities/subprocess";
import { Logger } from "../Logger";

export class Metro implements Disposable {
  private subprocess?: ChildProcess;
  private _port = 0;

  constructor(
    private readonly appRoot: string,
    private readonly extensionRoot: string,
    private readonly devtoolsPort: number
  ) {}

  public get port() {
    return this._port;
  }

  public dispose() {
    this.subprocess?.kill();
  }

  public async start() {
    this.subprocess = exec(
      `${this.appRoot}/node_modules/react-native/scripts/packager.sh`,
      [
        "--reset-cache",
        "--no-interactive",
        "--port",
        "0",
        "--config",
        path.join(this.extensionRoot, "lib/metro_config.js"),
      ],
      {
        cwd: this.appRoot,
        env: {
          ...process.env,
          NODE_PATH: path.join(this.appRoot, "node_modules"),
          RCT_METRO_PORT: "0",
          RCT_DEVTOOLS_PORT: this.devtoolsPort.toString(),
          REACT_NATIVE_IDE_LIB_PATH: path.join(this.extensionRoot, "lib"),
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
}
