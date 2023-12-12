import { ChildProcess } from "child_process";
import path from "path";
import readline from "readline";
import { Disposable } from "vscode";
import { spawnWithLog } from "../utilities/subprocess";

export class Metro implements Disposable {
  private subprocess?: ChildProcess;

  constructor(
    private readonly appRoot: string,
    private readonly extensionRoot: string,
    public readonly port: number,
    private readonly devtoolsPort: number
  ) {}

  public dispose() {
    this.subprocess?.kill();
  }

  public async start() {
    this.subprocess = spawnWithLog(
      "node",
      [
        path.join(this.extensionRoot, "lib/metro.js"),
        this.appRoot,
        path.join(this.extensionRoot, "lib"),
      ],
      {
        cwd: this.appRoot,
        env: {
          ...process.env,
          // DEBUG: "Metro:InspectorProxy",
          NODE_PATH: path.join(this.appRoot, "node_modules"),
          RCT_METRO_PORT: this.port.toString(),
          RCT_DEVTOOLS_PORT: this.devtoolsPort.toString(),
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
        if (line.includes("Welcome to Metro")) {
          resolve();
        }
      });
    });
    return initPromise;
  }

  public async reload() {
    await fetch(`http://localhost:${this.port}/reload`);
  }
}
