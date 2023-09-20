import { IOSProjectInfo } from "@react-native-community/cli-types";
import { CLIError, printRunDoctorTip, getLoader } from "@react-native-community/cli-tools";
import type { ChildProcess, SpawnOptionsWithoutStdio } from "child_process";

const child_process = require("child_process");

export type BuildFlags = {
  mode: string;
  verbose: boolean;
  xcconfig?: string;
  buildFolder?: string;
  buildCwd: string;
  port?: number;
  interactive?: boolean;
  destination?: string;
  extraParams?: string[];
};

export function buildProject(
  xcodeProject: IOSProjectInfo,
  udid: string | undefined,
  scheme: string,
  args: BuildFlags
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xcodebuildArgs = [
      xcodeProject.isWorkspace ? "-workspace" : "-project",
      xcodeProject.name,
      ...(args.xcconfig ? ["-xcconfig", args.xcconfig] : []),
      ...(args.buildFolder ? ["-derivedDataPath", args.buildFolder] : []),
      "-configuration",
      args.mode,
      "-scheme",
      scheme,
      "-destination",
      (udid
        ? `id=${udid}`
        : args.mode === "Debug"
        ? "generic/platform=iOS Simulator"
        : "generic/platform=iOS") + (args.destination ? "," + args.destination : ""),
    ];

    if (args.extraParams) {
      xcodebuildArgs.push(...args.extraParams);
    }

    const loader = getLoader();
    console.log(`Building using "xcodebuild ${xcodebuildArgs.join(" ")}`);
    let xcodebuildOutputFormatter: ChildProcess | any;
    if (!args.verbose) {
      if (xcbeautifyAvailable()) {
        xcodebuildOutputFormatter = child_process.spawn("xcbeautify", [], {
          stdio: ["pipe", process.stdout, process.stderr],
        });
      } else if (xcprettyAvailable()) {
        xcodebuildOutputFormatter = child_process.spawn("xcpretty", [], {
          stdio: ["pipe", process.stdout, process.stderr],
        });
      }
    }

    const processOptions = {
      env: {
        ...process.env,
        RCT_NO_LAUNCH_PACKAGER: "true",
        RCT_METRO_PORT: (args?.port || 8081).toString(),
        NODE_BINARY: "/usr/local/bin/node",
      },
      cwd: args.buildCwd,
    };

    const buildProcess = child_process.spawn("xcodebuild", xcodebuildArgs, processOptions);
    let buildOutput = "";
    let errorOutput = "";
    buildProcess.stdout.on("data", (data: Buffer) => {
      const stringData = data.toString();
      buildOutput += stringData;
      if (xcodebuildOutputFormatter) {
        xcodebuildOutputFormatter.stdin.write(data);
      } else {
        console.log(`Building the app${".".repeat(buildOutput.length % 10)}`);
      }
    });

    buildProcess.stderr.on("data", (data: Buffer) => {
      errorOutput += data;
    });
    buildProcess.on("close", (code: number) => {
      if (xcodebuildOutputFormatter) {
        xcodebuildOutputFormatter.stdin.end();
      } else {
        loader.stop();
      }
      if (code !== 0) {
        printRunDoctorTip();
        reject(
          new CLIError(
            `
            Failed to build iOS project.

            "xcodebuild" exited with error code '${code}'. To debug build
            logs further, consider building your app with Xcode.app, by opening
            '${xcodeProject.name}'.
          `,
            xcodebuildOutputFormatter ? undefined : buildOutput + "\n" + errorOutput
          )
        );
        return;
      }
      console.log("Successfully built the app");
      resolve(buildOutput);
    });
  });
}

function xcbeautifyAvailable() {
  try {
    child_process.execSync("xcbeautify --version", {
      stdio: [0, "pipe", "ignore"],
    });
  } catch (error) {
    return false;
  }
  return true;
}

function xcprettyAvailable() {
  try {
    child_process.execSync("xcpretty --version", {
      stdio: [0, "pipe", "ignore"],
    });
  } catch (error) {
    return false;
  }
  return true;
}
