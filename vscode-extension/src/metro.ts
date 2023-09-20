import { ChildProcess } from "child_process";

const child_process = require("child_process");
const readline = require("readline");

function getListeningPort(pid: number) {
  let portFound = 0;
  child_process.exec(
    `lsof -i -n -P | grep LISTEN | grep ${pid}`,
    (error: any, stdout: string, stderr: string) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }

      // Split the stdout into lines and parse each line for the port number
      const lines = stdout.split("\n");
      lines.forEach((line) => {
        const match = line.match(/TCP \*:(\d+) \(LISTEN\)/);
        if (match && match[1]) {
          portFound = parseInt(match[1]);
        }
      });
    }
  );
  return portFound;
}

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
