import { ChildProcess } from "child_process";

const child_process = require("child_process");
const readline = require("readline");

export class Metro {
  private subprocess?: ChildProcess;
  private appRoot: string;
  private port: number;

  constructor(appRoot: string, port: number) {
    this.appRoot = appRoot;
    this.port = port;
  }

  public shutdown() {
    this.subprocess?.kill();
  }

  public async start() {
    this.subprocess = child_process.spawn(
      `${this.appRoot}/node_modules/react-native/scripts/packager.sh`,
      [],
      { env: { ...process.env, RCT_METRO_PORT: this.port } }
    );

    const rl = readline.createInterface({
      input: this.subprocess!.stdout,
      output: process.stdout,
      terminal: false,
    });

    const initPromise = new Promise<void>((resolve, reject) => {
      rl.on("line", (line: string) => {
        if (line.includes("Welcome to Metro")) {
          resolve();
        }
        process.stdout.write(`metro: ${line}`);
      });
    });
    return initPromise;
  }
}
