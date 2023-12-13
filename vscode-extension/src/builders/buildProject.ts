import { IOSProjectInfo } from "@react-native-community/cli-types";
import type { ChildProcess } from "child_process";
import { execSyncWithLog, spawnWithLog } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { IOS_FAIL_ERROR_MESSAGE } from "../utilities/common";

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

    Logger.log(`Building using "xcodebuild ${xcodebuildArgs.join(" ")}`);
    let xcodebuildOutputFormatter: ChildProcess | any;
    if (!args.verbose) {
      if (xcbeautifyAvailable()) {
        xcodebuildOutputFormatter = spawnWithLog("xcbeautify", [], {});
      } else if (xcprettyAvailable()) {
        xcodebuildOutputFormatter = spawnWithLog("xcpretty", [], {});
      }
    }

    const processOptions = {
      env: {
        ...process.env,
        RCT_NO_LAUNCH_PACKAGER: "true",
        NODE_BINARY: "/usr/local/bin/node",
      },
      cwd: args.buildCwd,
    };

    const buildProcess = spawnWithLog("xcodebuild", xcodebuildArgs, processOptions);
    let buildOutput = "";
    buildProcess.stdout?.on("data", (data: Buffer) => {
      const stringData = data.toString();
      buildOutput += stringData;
      if (xcodebuildOutputFormatter) {
        xcodebuildOutputFormatter.stdin.write(data);
      }
    });

    buildProcess.on("close", (code: number) => {
      if (xcodebuildOutputFormatter) {
        xcodebuildOutputFormatter.stdin.end();
      }
      if (code !== 0) {
        reject(new Error(`${IOS_FAIL_ERROR_MESSAGE} Failed to build iOS project.`));
        return;
      }
      Logger.log("Successfully built the app");
      resolve(buildOutput);
    });
  });
}

function xcbeautifyAvailable() {
  try {
    execSyncWithLog("xcbeautify --version");
  } catch (error) {
    return false;
  }
  return true;
}

function xcprettyAvailable() {
  try {
    execSyncWithLog("xcpretty --version");
  } catch (error) {
    return false;
  }
  return true;
}
