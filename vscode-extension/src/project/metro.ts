import { ChildProcess, spawn } from "child_process";
import os from "os";
import fs from "fs";
import path from "path";
import readline from "readline";

export class Metro {
  private subprocess?: ChildProcess;

  constructor(
    private readonly appRoot: string,
    private readonly extensionRoot: string,
    public readonly port: number,
    private readonly devtoolsPort: number
  ) {}

  public shutdown() {
    this.subprocess?.kill();
  }

  public async start() {
    this.subprocess = spawn(
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
        },
      }
    );

    this.subprocess?.stderr?.on("data", (data) => {
      console.error(`metro stderr: ${data}`);
    });

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
        console.log(`metro: ${line}`);
      });
    });
    return initPromise;
  }

  public async reload() {
    await fetch(`http://localhost:${this.port}/reload`);
  }
}
