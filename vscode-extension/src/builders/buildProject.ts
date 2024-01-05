import { IOSProjectInfo } from "@react-native-community/cli-types";
import { exec } from "../utilities/subprocess";
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

    Logger.debug(`Building using "xcodebuild ${xcodebuildArgs.join(" ")}`);
    const processOptions = {
      env: {
        ...process.env,
        RCT_NO_LAUNCH_PACKAGER: "true",
        NODE_BINARY: "/usr/local/bin/node",
      },
      cwd: args.buildCwd,
    };

    const buildProcess = exec("xcodebuild", xcodebuildArgs, processOptions);
    let buildOutput = "";
    buildProcess.stdout?.on("data", (data: Buffer) => {
      const stringData = data.toString();
      buildOutput += stringData;
    });

    buildProcess.on("close", (code: number) => {
      if (code !== 0) {
        reject(new Error(`${IOS_FAIL_ERROR_MESSAGE} Failed to build iOS project.`));
        return;
      }
      Logger.debug("Successfully built the app");
      resolve(buildOutput);
    });
  });
}
