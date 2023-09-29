import { ChildProcess } from "child_process";

const child_process = require("child_process");
const readline = require("readline");
const path = require("path");

export class Metro {
  private subprocess?: ChildProcess;
  private appRoot: string;
  private extensionRoot: string;
  private port: number;

  constructor(appRoot: string, extensionRoot: string, port: number) {
    this.appRoot = appRoot;
    this.extensionRoot = extensionRoot;
    this.port = port;
  }

  public shutdown() {
    this.subprocess?.kill();
  }

  public async start() {
    this.subprocess = child_process.spawn(
      'node',
      [
        path.join(this.extensionRoot, 'lib/metro.js'),
        this.port,
        this.appRoot,
        'index.js',
        this.extensionRoot,
      ],
      {
        cwd: this.appRoot,
        env: {
          ...process.env,
          RCT_METRO_PORT: this.port
        }
      }
    );

    this.subprocess.stderr.on('data', (data) => {
      console.error(`metro stderr: ${data}`);
    });

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
        console.log(`metro: ${line}`);
      });
    });
    return initPromise;
  }
}
